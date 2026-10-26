// Explicit opt-in runner. Kept outside test/ so node --test never boots a browser.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import { parse } from "dotenv";
import { test } from "node:test";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { cases } from "./journey.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const clientRequire = createRequire(
  new URL("../../client/package.json", import.meta.url),
);
const dbName = `fcinema_e2e_${process.pid}_${randomBytes(8).toString("hex")}`;
const artifacts = fileURLToPath(
  new URL(`../../.codex-tmp/e2e/${dbName}/`, import.meta.url),
);
const localEnv = parse(
  await readFile(new URL("../.env", import.meta.url), "utf8").catch(() => ""),
);
const uri = process.env.E2E_MONGODB_URI || localEnv.MONGODB_URI;
if (!uri)
  throw new Error(
    "E2E_MONGODB_URI or server/.env MONGODB_URI is required; only a unique disposable database is used",
  );
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = randomBytes(32).toString("hex");
process.env.CONCESSION_QUOTE_SECRET = randomBytes(32).toString("hex");
// Prevent dotenv/config inside migration imports from loading any development configuration.
process.env.DOTENV_CONFIG_PATH = fileURLToPath(
  new URL("./no-env-file", import.meta.url),
);
process.env.CLIENT_URL = "http://127.0.0.1";

test(
  "E2E-001 real browser / Express / isolated MongoDB",
  { timeout: 600000 },
  async (t) => {
    let backend, vite, browser, db;
    const summary = [];
    let databaseDropped = false;
    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      const failures = [];
      for (const operation of [
        async () => browser?.close(),
        async () => vite?.close(),
        async () => {
          if (backend) {
            backend.closeAllConnections();
            await new Promise((resolve, reject) =>
              backend.close((e) => (e ? reject(e) : resolve())),
            );
          }
        },
        async () => {
          if (db) {
            if (
              db.databaseName !== dbName ||
              !/^fcinema_e2e_\d+_[a-f0-9]+$/.test(dbName)
            )
              throw new Error("Unsafe cleanup target");
            await db.dropDatabase();
            databaseDropped = true;
            console.log("Disposable E2E database dropped");
          }
        },
        async () => mongoose.disconnect(),
      ]) {
        try {
          await operation();
        } catch {
          failures.push("Resource cleanup failed");
        }
      }
      if (failures.length) throw new Error(failures.join("; "));
    };
    const interrupted = () => {
      cleanup().finally(() => process.exit(130));
    };
    process.once("SIGINT", interrupted);
    process.once("SIGTERM", interrupted);
    t.after(cleanup);
    try {
      const playwrightPath = process.env.E2E_PLAYWRIGHT_MODULE;
      let playwright;
      try {
        playwright = await import(
          pathToFileURL(playwrightPath || clientRequire.resolve("playwright"))
            .href
        );
      } catch {
        throw new Error(
          "Playwright unavailable: set E2E_PLAYWRIGHT_MODULE to an existing playwright/index.mjs (see docs/E2E-001-IMPLEMENTATION.md)",
        );
      }
      browser = await playwright.chromium.launch({
        headless: true,
        ...(process.env.E2E_BROWSER_CHANNEL
          ? { channel: process.env.E2E_BROWSER_CHANNEL }
          : {}),
      });
      configureMongoDns(
        process.env.MONGODB_DNS_SERVERS || localEnv.MONGODB_DNS_SERVERS,
      );
      try {
        await mongoose.connect(uri, {
          dbName,
          autoIndex: false,
          autoCreate: false,
          serverSelectionTimeoutMS: 15000,
        });
      } catch {
        throw new Error(
          "Isolated MongoDB connection failed (connection details suppressed)",
        );
      }
      db = mongoose.connection.db;
      if (db.databaseName !== dbName)
        throw new Error("Database target mismatch");
      const hello = await db.admin().command({ hello: 1 });
      if (!hello.setName && hello.msg !== "isdbgrid")
        throw new Error("E2E needs replica-set/sharded MongoDB transactions");
      const { default: app } = await import("../src/app.js");
      for (const model of Object.values(mongoose.models))
        await model.createCollection();
      for (const model of Object.values(mongoose.models))
        await model.createIndexes();
      const { ensureConcessionCheckoutIndexes } =
        await import("../src/migrations/20261025-concession-checkout.js");
      await ensureConcessionCheckoutIndexes(db);
      backend = app.listen(0, "127.0.0.1");
      await once(backend, "listening");
      const api = `http://127.0.0.1:${backend.address().port}`;
      const { createServer } = await import(
        pathToFileURL(clientRequire.resolve("vite")).href
      );
      vite = await createServer({
        root: `${root}client`,
        define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api") },
        server: {
          host: "127.0.0.1",
          port: 0,
          strictPort: true,
          proxy: { "/api": { target: api, changeOrigin: true } },
        },
      });
      await vite.listen();
      const baseURL = `http://127.0.0.1:${vite.httpServer.address().port}`;
      process.env.CLIENT_URL = baseURL;
      await mkdir(artifacts, { recursive: true });
      console.log(
        "Running real frontend and backend on dedicated loopback ports",
      );
      for (const [name, run] of cases) {
        if (
          process.env.E2E_CASE &&
          !process.env.E2E_CASE.split(",").some((prefix) =>
            name.startsWith(prefix.trim()),
          )
        )
          continue;
        console.log(`Starting ${name}`);
        await t.test(name, { timeout: 90000 }, async (subtest) => {
          if (db.databaseName !== dbName)
            throw new Error("Unsafe test reset target");
          for (const { name: collection } of await db
            .listCollections({}, { nameOnly: true })
            .toArray()) {
            if (!collection.startsWith("system."))
              await db.collection(collection).deleteMany({});
          }
          const context = await browser.newContext({
            baseURL,
            viewport: { width: 1440, height: 1000 },
          });
          const abortContext = () => {
            context.close().catch(() => {});
          };
          subtest.signal.addEventListener("abort", abortContext, {
            once: true,
          });
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          const network = [];
          // Allowlisted metadata only: no request bodies, query values, headers, cookies or JWT.
          page.on("response", (response) => {
            const url = new URL(response.url());
            if (url.pathname.startsWith("/api/"))
              network.push({
                method: response.request().method(),
                path: url.pathname,
                status: response.status(),
              });
          });
          try {
            await run({ page, context, browser, db, baseURL });
            summary.push({ name, status: "passed" });
          } catch (error) {
            summary.push({ name, status: "failed" });
            const key = name.replace(/[^a-z0-9]+/gi, "-");
            // Screenshots redact editable values, including any login password.
            await page
              .screenshot({
                path: `${artifacts}/${key}.png`,
                fullPage: true,
                mask: [page.locator("input"), page.locator("textarea")],
              })
              .catch(() => {});
            await writeFile(
              `${artifacts}/${key}.network.json`,
              JSON.stringify(network, null, 2),
            );
            throw error;
          } finally {
            subtest.signal.removeEventListener("abort", abortContext);
            await context.close();
          }
        });
      }
      if (summary.length === 0)
        throw new Error("E2E_CASE did not select any scenario");
    } finally {
      await cleanup();
      process.removeListener("SIGINT", interrupted);
      process.removeListener("SIGTERM", interrupted);
      await mkdir(artifacts, { recursive: true });
      await writeFile(
        `${artifacts}/results.json`,
        JSON.stringify(
          {
            databaseDropped,
            node: process.version,
            browser: browser?.version(),
            cases: summary,
          },
          null,
          2,
        ),
      );
    }
  },
);
