import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";

export const COUNTER_CONCESSION_INDEXES = [
  [
    "payments",
    { orderId: 1 },
    {
      name: "uniq_payment_order",
      unique: true,
      partialFilterExpression: { orderId: { $type: "objectId" } },
    },
  ],
];

export async function ensureCounterConcessionIndexes(db) {
  const results = [];
  for (const [collection, fields, options] of COUNTER_CONCESSION_INDEXES) {
    results.push(`${collection}.${await db.collection(collection).createIndex(fields, options)}`);
  }
  return results;
}

export async function runMigration(args = process.argv.slice(2)) {
  const apply = args.includes("--apply");
  const dbName = args[args.indexOf("--db") + 1];
  if (!args.includes("--db") || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(dbName ?? ""))
    throw new Error("Explicit --db DATABASE is required");
  if (!apply) {
    console.log(`DRY RUN: ${dbName}; planned index payments.uniq_payment_order; no connection or writes.`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Production migration requires deployment owner workflow");
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(uri);
  if (!local && !args.includes("--allow-remote")) throw new Error("Remote apply requires --allow-remote");
  configureMongoDns();
  try {
    await mongoose.connect(uri, { dbName, autoCreate: false, autoIndex: false });
    if (mongoose.connection.db.databaseName !== dbName) throw new Error("Database target mismatch");
    console.log(await ensureCounterConcessionIndexes(mongoose.connection.db));
  } finally { await mongoose.disconnect(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration().catch((error) => {
    console.error(`Counter concession migration failed (${error.code ?? error.name}). No indexes were dropped.`);
    process.exitCode = 1;
  });
}
