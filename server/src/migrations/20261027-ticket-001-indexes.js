import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import { TICKET_INDEXES } from "../modules/ticket/ticket.indexes.js";

// TICKET-001. Ticket model disables autoIndex, so issuance idempotency depends on this migration.
// An equivalent existing index (e.g. bootstrap `ticketCode_1`) is kept under its own name; an
// incompatible one stops the migration without dropping or replacing anything.
export const ensureTicket001Indexes = async (database) => {
  const tickets = database.collection("tickets");
  let existingIndexes;
  try {
    existingIndexes = await tickets.listIndexes().toArray();
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

  const plan = TICKET_INDEXES.map(({ fields, options }) => {
    const related = existingIndexes.filter(
      (index) => sameKey(index.key, fields) || index.name === options.name,
    );
    for (const index of related) {
      if (
        !sameKey(index.key, fields) ||
        !isDeepStrictEqual(comparableOptions(index), comparableOptions(options))
      ) {
        throw new Error(
          `Incompatible Ticket index ${index.name}; no indexes were dropped or replaced.`,
        );
      }
    }
    return { fields, options, existing: related[0] };
  });

  const readyIndexes = [];
  for (const { fields, options, existing } of plan) {
    readyIndexes.push(existing?.name ?? (await tickets.createIndex(fields, options)));
  }

  return readyIndexes;
};

const run = async () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error("MONGODB_URI is required");

  configureMongoDns();
  await mongoose.connect(mongodbUri);
  try {
    const indexes = await ensureTicket001Indexes(mongoose.connection.db);
    console.log(`TICKET-001 indexes ready: ${indexes.join(", ")}`);
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  run().catch((error) => {
    console.error("TICKET-001 index migration failed:", error.message);
    process.exitCode = 1;
  });
}
