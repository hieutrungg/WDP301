import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import { BOOKING_INDEXES } from "../modules/booking/booking.indexes.js";

export const ensureBooking009Indexes = async (database) => {
  const bookings = database.collection("bookings");
  let existingIndexes;
  try {
    existingIndexes = await bookings.listIndexes().toArray();
  } catch (error) {
    if (error.code !== 26) throw error; // A fresh database has no bookings collection yet.
    existingIndexes = [];
  }

  const sameKey = (left, right) =>
    isDeepStrictEqual(Object.entries(left), Object.entries(right));
  const comparableOptions = (index) => ({
    unique: index.unique === true,
    sparse: index.sparse === true,
    hidden: index.hidden === true,
    partialFilterExpression: index.partialFilterExpression ?? null,
    collation: index.collation ?? null,
    expireAfterSeconds: index.expireAfterSeconds ?? null,
  });

  // Check every definition before writing. Never drop an existing index to resolve a conflict.
  const plan = BOOKING_INDEXES.map(({ fields, options }) => {
    const related = existingIndexes.filter((index) =>
      sameKey(index.key, fields) || index.name === options.name,
    );
    for (const index of related) {
      // New Bookings require every indexed field. An existing full unique index
      // also enforces uniqueness for those documents; preserve its stronger legacy constraint.
      const actualOptions = comparableOptions(index);
      const expectedOptions = comparableOptions(options);
      if (
        options.unique === true &&
        options.partialFilterExpression &&
        !index.partialFilterExpression
      ) {
        actualOptions.partialFilterExpression = options.partialFilterExpression;
      }
      if (
        !sameKey(index.key, fields) ||
        !isDeepStrictEqual(actualOptions, expectedOptions)
      ) {
        throw new Error(`Incompatible Booking index ${index.name}; no indexes were dropped or replaced.`);
      }
    }
    return { fields, options, existing: related[0] };
  });

  const readyIndexes = [];
  for (const { fields, options, existing } of plan) {
    readyIndexes.push(existing?.name ?? await bookings.createIndex(fields, options));
  }

  return readyIndexes;
};

const run = async () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error("MONGODB_URI is required");

  configureMongoDns();
  await mongoose.connect(mongodbUri);
  try {
    const indexes = await ensureBooking009Indexes(mongoose.connection.db);
    console.log(`BOOK-009 indexes ready: ${indexes.join(", ")}`);
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  run().catch((error) => {
    console.error("BOOK-009 index migration failed:", error.message);
    process.exitCode = 1;
  });
}
