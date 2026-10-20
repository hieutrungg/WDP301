import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import {
  COLLECTION,
  TICKET_PRICE_PLAN_VALIDATOR,
} from "../migrations/20261018-ticket-price-plans.js";

class PricePlanSeedError extends Error {}

// Hieu approved these adult 2D prices in chat on 2026-10-20.
// DOUBLE_LUXURY is the complete price for the pair, charged once.
// Day selection belongs to the future Showtime pricing integration, not this seed.
export const buildTicketPricePlanSeeds = () => [
  {
    code: "ADULT_2D_WEEKDAY",
    name: "Adult 2D - Monday to Thursday",
    version: 1,
    status: "ACTIVE",
    currency: "VND",
    seatTypePrices: { STANDARD: 105000, VIP: 110500, DOUBLE_LUXURY: 236000 },
  },
  {
    code: "ADULT_2D_WEEKEND",
    name: "Adult 2D - Friday to Sunday",
    version: 1,
    status: "ACTIVE",
    currency: "VND",
    seatTypePrices: { STANDARD: 125000, VIP: 130500, DOUBLE_LUXURY: 276000 },
  },
];

const assertMatchingPlan = (existing, expected) => {
  if (
    existing.status !== expected.status ||
    existing.currency !== expected.currency ||
    !isDeepStrictEqual(existing.seatTypePrices, expected.seatTypePrices)
  ) {
    throw new PricePlanSeedError(
      `${expected.code} v${expected.version} already has different prices, currency or status. No existing plan was changed; review and use a new version for price changes.`,
    );
  }
};

export const seedTicketPricePlans = async (
  database,
  { apply = false, clock = () => new Date() } = {},
) => {
  const plans = buildTicketPricePlanSeeds();
  const result = { database: database.databaseName, collection: COLLECTION, apply, plans };
  // Offline preview: no connection, collection reads, schema changes or writes.
  if (!apply) return result;

  const info = await database.listCollections({ name: COLLECTION }, { nameOnly: false }).next();
  if (
    !info || info.type !== "collection" ||
    !isDeepStrictEqual(info.options?.validator, TICKET_PRICE_PLAN_VALIDATOR) ||
    (info.options?.validationLevel ?? "strict") !== "strict" ||
    (info.options?.validationAction ?? "error") !== "error"
  ) {
    throw new PricePlanSeedError("ticket_price_plans must already have the reviewed strict validator. This seed does not create collections or replace validators.");
  }

  const collection = database.collection(COLLECTION);
  const indexes = await collection.listIndexes().toArray();
  if (!indexes.some((index) =>
    isDeepStrictEqual(Object.entries(index.key), [["code", 1], ["version", 1]]) &&
    index.unique === true && !index.sparse && !index.partialFilterExpression && !index.collation,
  )) {
    throw new PricePlanSeedError("A full unique index on code + version is required. No indexes were created or replaced.");
  }

  // Inspect both versions before the first insert, so a known conflict cannot partially seed.
  const pending = [];
  for (const plan of plans) {
    const existing = await collection.findOne({ code: plan.code, version: plan.version });
    if (existing) assertMatchingPlan(existing, plan);
    pending.push({ plan, existing });
  }

  const now = clock();
  const outcomes = [];
  for (const { plan, existing } of pending) {
    let action = "UNCHANGED";
    if (!existing) {
      try {
        await collection.insertOne({ ...plan, createdAt: now, updatedAt: now });
        action = "INSERTED";
      } catch (error) {
        if (error.code !== 11000) throw error;
        // A concurrent run may have inserted this exact version after our preflight.
        const winner = await collection.findOne({ code: plan.code, version: plan.version });
        if (!winner) throw error;
        assertMatchingPlan(winner, plan);
      }
    }
    outcomes.push({ code: plan.code, version: plan.version, action });
  }
  return { ...result, outcomes };
};

const run = async () => {
  const { values } = parseArgs({ options: {
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    database: { type: "string" },
  } });
  if (values.apply && values["dry-run"]) {
    throw new PricePlanSeedError("Choose --apply or --dry-run, not both.");
  }
  const databaseName = values.database?.trim();
  if (!databaseName || !/^[A-Za-z0-9_-]{1,63}$/.test(databaseName)) {
    throw new PricePlanSeedError("Specify --database <name> using letters, digits, underscores or hyphens.");
  }
  if (!values.apply) {
    console.log(JSON.stringify(await seedTicketPricePlans({ databaseName }), null, 2));
    console.log("Offline preview only. No MongoDB connection or writes were made.");
    return;
  }
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new PricePlanSeedError("MONGODB_URI is required in server/.env.");
  configureMongoDns();
  const connection = mongoose.createConnection();
  try {
    await connection.openUri(uri, {
      dbName: databaseName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
    });
    const result = await seedTicketPricePlans(connection.db, { apply: true });
    console.log(`${databaseName}.${COLLECTION}:`);
    console.table(result.outcomes);
    console.log("No Showtime, SeatHold, Booking, role or permission was modified.");
  } finally {
    await connection.close();
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((error) => {
    // Driver/DNS failures can contain connection details. Only print our safe operational errors.
    console.error(error instanceof PricePlanSeedError
      ? error.message
      : "Price-plan seed failed. Check MongoDB connectivity, permissions and database configuration.");
    process.exitCode = 1;
  });
}
