import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { SEAT_TYPES } from "../src/modules/room/room.constants.js";
import {
  COLLECTION, TICKET_PRICE_PLAN_VALIDATOR, migrateTicketPricePlans,
} from "../src/migrations/20261018-ticket-price-plans.js";
import { buildTicketPricePlanSeeds, seedTicketPricePlans } from "../src/seeds/seed-ticket-price-plans.js";

const fixture = ({ documents = [], validSchema = true, validIndex = true, missing = false, onInsert } = {}) => {
  const writes = [];
  const database = {
    databaseName: "pricing_seed_test",
    listCollections(filter) {
      assert.deepEqual(filter, { name: COLLECTION });
      return { async next() {
        return missing ? null : { type: "collection", options: {
          validator: validSchema ? structuredClone(TICKET_PRICE_PLAN_VALIDATOR) : {},
          validationLevel: "strict", validationAction: "error",
        } };
      } };
    },
    collection(name) {
      assert.equal(name, COLLECTION, "Seed must never access transactional or auth collections");
      return {
        listIndexes() { return { async toArray() {
          return validIndex ? [{ key: { code: 1, version: 1 }, name: "legacy_unique_name", unique: true }] : [];
        } }; },
        async findOne({ code, version }) {
          return documents.find((document) => document.code === code && document.version === version) ?? null;
        },
        async insertOne(document) {
          if (onInsert) await onInsert(document, documents);
          writes.push(structuredClone(document));
          documents.push(structuredClone(document));
        },
      };
    },
  };
  return { database, writes, documents };
};

test("price seed uses the approved integer VND prices and complete Sweetbox pair amounts", () => {
  const [weekday, weekend] = buildTicketPricePlanSeeds();
  assert.deepEqual(weekday.seatTypePrices, { STANDARD: 105000, VIP: 110500, DOUBLE_LUXURY: 236000 });
  assert.deepEqual(weekend.seatTypePrices, { STANDARD: 125000, VIP: 130500, DOUBLE_LUXURY: 276000 });
  for (const plan of [weekday, weekend]) {
    assert.equal(plan.seatTypePrices.DOUBLE_LUXURY, 2 * plan.seatTypePrices.STANDARD + 26000);
    assert.deepEqual(Object.keys(plan.seatTypePrices).sort(), [...SEAT_TYPES].sort());
    assert.ok(Object.values(plan.seatTypePrices).every(Number.isSafeInteger));
    assert.equal(plan.currency, "VND");
    assert.equal(plan.version, 1);
  }
});

test("price seed defaults to an offline preview requiring no database operations", async () => {
  const result = await seedTicketPricePlans({ databaseName: "pricing_seed_test" });
  assert.equal(result.apply, false);
  assert.equal(result.plans.length, 2);
});

test("price seed inserts only two complete plans and a rerun preserves documents and timestamps", async () => {
  const state = fixture();
  const now = new Date("2026-10-20T03:00:00Z");
  const first = await seedTicketPricePlans(state.database, { apply: true, clock: () => now });
  assert.ok(first.outcomes.every(({ action }) => action === "INSERTED"));
  assert.equal(state.writes.length, 2);
  assert.ok(state.documents.every(({ createdAt, updatedAt }) => createdAt.getTime() === now.getTime() && updatedAt.getTime() === now.getTime()));
  state.documents[0].name = "Name maintained by the pricing owner";
  const before = structuredClone(state.documents);
  const second = await seedTicketPricePlans(state.database, { apply: true });
  assert.ok(second.outcomes.every(({ action }) => action === "UNCHANGED"));
  assert.equal(state.writes.length, 2);
  assert.deepEqual(state.documents, before);
});

test("price seed checks both existing plans for conflicts before the first write", async () => {
  for (const change of [
    { seatTypePrices: { STANDARD: 1, VIP: 130500, DOUBLE_LUXURY: 276000 } },
    { currency: "USD" }, { status: "RETIRED" }, { status: "DRAFT" },
  ]) {
    const document = { ...buildTicketPricePlanSeeds()[1], ...change };
    const state = fixture({ documents: [document] });
    await assert.rejects(seedTicketPricePlans(state.database, { apply: true }), /already has different/);
    assert.equal(state.writes.length, 0);
    assert.deepEqual(state.documents, [document]);
  }
});

test("price seed requires the existing strict collection and full version uniqueness index", async () => {
  for (const options of [{ missing: true }, { validSchema: false }, { validIndex: false }]) {
    const state = fixture(options);
    await assert.rejects(seedTicketPricePlans(state.database, { apply: true }), /validator|unique index/);
    assert.equal(state.writes.length, 0);
  }
});

test("price seed recovers an identical concurrent insert without updating the winning plan", async () => {
  const state = fixture({ onInsert(document, documents) {
    documents.push(structuredClone(document));
    throw Object.assign(new Error("concurrent insert"), { code: 11000 });
  } });
  const result = await seedTicketPricePlans(state.database, { apply: true });
  assert.ok(result.outcomes.every(({ action }) => action === "UNCHANGED"));
  assert.equal(state.writes.length, 0);
  assert.equal(state.documents.length, 2);
});

test("price seed refuses a conflicting concurrent insert", async () => {
  const state = fixture({ onInsert(document, documents) {
    documents.push({ ...document, seatTypePrices: { ...document.seatTypePrices, STANDARD: 1 } });
    throw Object.assign(new Error("concurrent insert"), { code: 11000 });
  } });
  await assert.rejects(seedTicketPricePlans(state.database, { apply: true }), /already has different/);
  assert.equal(state.writes.length, 0);
});

test("price seed CLI preview is offline and rejects conflicting flags or missing target", () => {
  const script = fileURLToPath(new URL("../src/seeds/seed-ticket-price-plans.js", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8", env: { ...process.env, MONGODB_URI: "invalid-offline-preview-uri" },
  });
  const preview = run("--database", "pricing_seed_test", "--dry-run");
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Offline preview only/);
  assert.match(preview.stdout, /236000/);
  assert.equal(run("--database", "pricing_seed_test", "--apply", "--dry-run").status, 1);
  assert.equal(run().status, 1);
});

const testUri = process.env.MONGODB_TEST_URI?.trim();
test("MongoDB price seed is idempotent under concurrent inserts", {
  skip: !testUri && "MONGODB_TEST_URI is not configured; no live database seed was run",
}, async () => {
  assert.match(testUri.split("?")[0].split("/").at(-1), /test/i, "Use a dedicated test URI");
  const databaseName = `pricing_seed_test_${randomUUID().replaceAll("-", "")}`;
  const connection = mongoose.createConnection();
  try {
    configureMongoDns();
    await connection.openUri(testUri, { dbName: databaseName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    await migrateTicketPricePlans(connection.db, { apply: true });
    await Promise.all([
      seedTicketPricePlans(connection.db, { apply: true }),
      seedTicketPricePlans(connection.db, { apply: true }),
    ]);
    const collection = connection.db.collection(COLLECTION);
    assert.equal(await collection.countDocuments(), 2);
    const before = await collection.find().sort({ code: 1 }).toArray();
    await seedTicketPricePlans(connection.db, { apply: true });
    assert.deepEqual(await collection.find().sort({ code: 1 }).toArray(), before);
  } finally {
    try {
      if (connection.readyState === 1) {
        assert.equal(connection.db.databaseName, databaseName);
        await connection.db.collection(COLLECTION).drop().catch((error) => {
          if (error.code !== 26) throw error;
        });
      }
    } finally { await connection.close(); }
  }
});
