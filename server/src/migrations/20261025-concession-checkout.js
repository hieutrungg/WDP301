import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";

// Opt-in DDL only. Never seeds food, rewrites stock, drops indexes or backfills counters.
export const CHECKOUT_INDEXES = [
  [
    "orders",
    { bookingId: 1 },
    {
      name: "uniq_concession_booking",
      unique: true,
      partialFilterExpression: { bookingId: { $type: "objectId" } },
    },
  ],
  [
    "orders",
    { orderCode: 1 },
    { name: "uniq_concession_order_code", unique: true },
  ],
  [
    "inventory_reservations",
    { orderId: 1 },
    { name: "uniq_reservation_order", unique: true },
  ],
  [
    "inventory_reservations",
    { branchId: 1, status: 1, expiresAt: 1 },
    { name: "idx_reservation_expiry" },
  ],
  [
    "stock_transactions",
    { orderId: 1, concessionId: 1 },
    {
      name: "uniq_online_order_sale",
      unique: true,
      partialFilterExpression: {
        source: "ONLINE_CHECKOUT",
        orderId: { $type: "objectId" },
      },
    },
  ],
  [
    "inventories",
    { branchId: 1, concessionId: 1 },
    { name: "uniq_inventory_branch_concession", unique: true },
  ],
];

export async function ensureConcessionCheckoutIndexes(db) {
  const results = [];
  for (const [name, fields, options] of CHECKOUT_INDEXES) {
    results.push(
      `${name}.${await db.collection(name).createIndex(fields, options)}`,
    );
  }
  return results;
}

export async function runMigration(args = process.argv.slice(2)) {
  const apply = args.includes("--apply");
  const dbName = args[args.indexOf("--db") + 1];
  if (!args.includes("--db") || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(dbName ?? ""))
    throw new Error("Explicit --db DATABASE is required");
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "Production migration requires the deployment owner workflow",
    );
  if (!apply) {
    console.log(
      `DRY RUN: ${dbName}; no connection or writes. Planned indexes: ${CHECKOUT_INDEXES.map(([collection, , options]) => `${collection}.${options.name}`).join(", ")}`,
    );
    return;
  }
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is required");
  const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(uri);
  if (!local && !args.includes("--allow-remote"))
    throw new Error(
      "Remote apply requires --allow-remote and an explicit --db",
    );
  configureMongoDns();
  try {
    await mongoose.connect(uri, {
      dbName,
      autoCreate: false,
      autoIndex: false,
    });
    if (mongoose.connection.db.databaseName !== dbName)
      throw new Error("Database target mismatch");
    console.log(await ensureConcessionCheckoutIndexes(mongoose.connection.db));
  } finally {
    await mongoose.disconnect();
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  runMigration().catch((error) => {
    // Connection errors may contain credentials; never print their raw text.
    console.error(
      `CON-102 migration failed (${error.code ?? error.name}); inspect the target and index compatibility. No indexes were dropped.`,
    );
    process.exitCode = 1;
  });
}
