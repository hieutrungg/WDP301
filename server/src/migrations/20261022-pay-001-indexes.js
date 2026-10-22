import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import { PAYMENT_INDEXES } from "../modules/payment/payment.indexes.js";

export const ensurePay001Indexes = async (database) => {
  const payments = database.collection("payments");
  let existingIndexes;
  try {
    existingIndexes = await payments.listIndexes().toArray();
  } catch (error) {
    if (error.code !== 26) throw error;
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

  const plan = PAYMENT_INDEXES.map(({ fields, options }) => {
    const related = existingIndexes.filter(
      (index) => sameKey(index.key, fields) || index.name === options.name,
    );
    for (const index of related) {
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
        throw new Error(
          `Incompatible Payment index ${index.name}; no indexes were dropped or replaced.`,
        );
      }
    }
    return { fields, options, existing: related[0] };
  });

  const readyIndexes = [];
  for (const { fields, options, existing } of plan) {
    readyIndexes.push(
      existing?.name ?? (await payments.createIndex(fields, options)),
    );
  }

  return readyIndexes;
};

const run = async () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error("MONGODB_URI is required");

  configureMongoDns();
  await mongoose.connect(mongodbUri);
  try {
    const indexes = await ensurePay001Indexes(mongoose.connection.db);
    console.log(`PAY-001 indexes ready: ${indexes.join(", ")}`);
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  run().catch((error) => {
    console.error("PAY-001 index migration failed:", error.message);
    process.exitCode = 1;
  });
}
