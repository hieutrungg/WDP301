import "dotenv/config";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import {
  PROMOTION_VALIDATORS,
  PROMOTION_INDEXES,
  auditPromotionData,
  inspectPromotionStorage,
  indexMatches,
} from "../modules/promotion/promotion.storage.js";

// DDL only; no record updates, seed, backfill, index drops or data repair.
export async function applyPromotionStorage(db) {
  const errors = await auditPromotionData(db);
  if (errors.length)
    throw new Error(`Data review required before DDL: ${errors.join("; ")}`);
  const collections = await db.listCollections().toArray();
  // Preflight every index before changing any validator or creating a collection.
  for (const [name, key, options] of PROMOTION_INDEXES) {
    const indexes = collections.some((c) => c.name === name)
      ? await db.collection(name).listIndexes().toArray()
      : [];
    if (
      !indexes.some((i) => indexMatches(i, key, options)) &&
      indexes.some(
        (i) =>
          i.name === options.name ||
          JSON.stringify(i.key) === JSON.stringify(key),
      )
    )
      throw new Error(`Incompatible index on ${name}; no DDL performed`);
  }
  for (const [name, validator] of Object.entries(PROMOTION_VALIDATORS)) {
    if (!collections.some((c) => c.name === name))
      await db.createCollection(name, {
        validator,
        validationLevel: "strict",
        validationAction: "error",
      });
    else
      await db.command({
        collMod: name,
        validator,
        validationLevel: "strict",
        validationAction: "error",
      });
  }
  for (const [name, key, options] of PROMOTION_INDEXES) {
    const indexes = await db.collection(name).listIndexes().toArray();
    if (indexes.some((i) => indexMatches(i, key, options))) continue;
    // Stop rather than replacing an incompatible existing name/key definition.
    if (
      indexes.some(
        (i) =>
          i.name === options.name ||
          JSON.stringify(i.key) === JSON.stringify(key),
      )
    )
      throw new Error(`Incompatible index on ${name}; owner review required`);
    await db.collection(name).createIndex(key, options);
  }
  return inspectPromotionStorage(db);
}
export async function runPromotionMigration(args = process.argv.slice(2)) {
  const value = (flag) =>
    args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const database = value("--database");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(database ?? ""))
    throw new Error("Explicit --database DATABASE required");
  const apply = args.includes("--apply");
  if (apply && value("--confirm-database") !== database)
    throw new Error(
      "Apply requires --confirm-database with the exact database name",
    );
  if (process.env.NODE_ENV === "production")
    throw new Error("Use the deployment owner's production workflow");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI required");
  if (
    apply &&
    !/^mongodb:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(uri) &&
    !args.includes("--allow-remote")
  )
    throw new Error("Remote apply requires --allow-remote");
  configureMongoDns();
  try {
    await mongoose.connect(uri, {
      dbName: database,
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 10000,
    });
    const db = mongoose.connection.db;
    if (db.databaseName !== database)
      throw new Error("Database target mismatch");
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid")
      throw new Error("Replica-set/sharded transactions are required");
    const errors = await auditPromotionData(db);
    const storage = await inspectPromotionStorage(db);
    console.log(
      JSON.stringify(
        {
          database,
          mode: apply ? "APPLY" : "INSPECT_ONLY",
          errors,
          missing: storage.missing,
        },
        null,
        2,
      ),
    );
    if (errors.length)
      throw new Error("Incompatible data; no repairs or DDL performed");
    if (apply)
      console.log(JSON.stringify(await applyPromotionStorage(db), null, 2));
  } finally {
    await mongoose.disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runPromotionMigration().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
