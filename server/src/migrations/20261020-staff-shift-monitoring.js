import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import { STAFF_SHIFT_INDEXES } from "../modules/staff-shift/staff-shift.indexes.js";

// CMS_UC38: creates the indexes the shift monitoring queries use on `staff_shifts`.
// No backfill and no new collection: the audit fields UC38 adds to `staff_shifts` (createdBy,
// cancelledBy/At, approvedBy/At, approvalNote) are optional, so existing documents stay valid.
// Safe to re-run. It never drops or replaces an existing index; a conflicting one stops the run.

const sameKey = (left, right) => isDeepStrictEqual(Object.entries(left), Object.entries(right));

const listIndexes = async (collection) => {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (error.code !== 26) throw error; // The collection does not exist yet.
    return [];
  }
};

export const ensureStaffShiftIndexes = async (database) => {
  // Check every definition on every collection before writing anything.
  const plan = [];
  for (const [collectionName, definitions] of Object.entries(STAFF_SHIFT_INDEXES)) {
    const collection = database.collection(collectionName);
    const existingIndexes = await listIndexes(collection);

    for (const { fields, options } of definitions) {
      const related = existingIndexes.find((index) => sameKey(index.key, fields) || index.name === options.name);

      if (related && (!sameKey(related.key, fields) || (related.unique === true) !== (options.unique === true))) {
        throw new Error(`Incompatible index ${related.name} on ${collectionName}; no indexes were dropped or replaced.`);
      }

      plan.push({ collectionName, collection, fields, options, existing: related });
    }
  }

  const ready = [];
  for (const { collectionName, collection, fields, options, existing } of plan) {
    ready.push(`${collectionName}.${existing?.name ?? (await collection.createIndex(fields, options))}`);
  }

  return ready;
};

const run = async () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error("MONGODB_URI is required");

  configureMongoDns();
  await mongoose.connect(mongodbUri);
  try {
    const indexes = await ensureStaffShiftIndexes(mongoose.connection.db);
    console.log(`UC38 staff shift indexes ready: ${indexes.join(", ")}`);
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  run().catch((error) => {
    console.error("UC38 staff shift migration failed:", error.message);
    process.exitCode = 1;
  });
}
