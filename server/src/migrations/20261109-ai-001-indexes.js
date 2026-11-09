import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import { AI_INDEXES, AI_VECTOR_INDEXES } from "../modules/ai/ai.indexes.js";

// AI-001. Creates the AI collections and their TTL/unique indexes (all AI models use
// autoIndex: false). With --vector it also creates the two Atlas Vector Search indexes; they can
// instead be created by hand in the Atlas UI (docs/AI-001-ATLAS-SETUP.md). Nothing is dropped:
// an incompatible existing index stops the migration.

const comparable = (index) => ({
  unique: index.unique === true,
  expireAfterSeconds: index.expireAfterSeconds ?? null,
});

const sameKey = (left, right) => isDeepStrictEqual(Object.entries(left), Object.entries(right));

export const ensureAi001Indexes = async (database) => {
  const existingCollections = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const ready = [];
  for (const [collectionName, indexes] of Object.entries(AI_INDEXES)) {
    if (!existingCollections.has(collectionName)) await database.createCollection(collectionName);
    const collection = database.collection(collectionName);
    const existing = await collection.listIndexes().toArray();
    for (const { fields, options } of indexes) {
      const related = existing.filter((index) => index.name === options.name || sameKey(index.key, fields));
      for (const index of related) {
        if (!sameKey(index.key, fields) || !isDeepStrictEqual(comparable(index), comparable(options))) {
          throw new Error(`Incompatible index ${collectionName}.${index.name}; nothing was dropped or replaced.`);
        }
      }
      ready.push(`${collectionName}.${related[0]?.name ?? (await collection.createIndex(fields, options))}`);
    }
  }
  return ready;
};

export const ensureAi001VectorIndexes = async (database) => {
  const ready = [];
  for (const { collection: collectionName, name, definition } of AI_VECTOR_INDEXES) {
    const collection = database.collection(collectionName);
    const existing = await collection.listSearchIndexes(name).toArray();
    if (existing.length) {
      ready.push(`${collectionName}.${name} (exists, status ${existing[0].status ?? "unknown"})`);
      continue;
    }
    await collection.createSearchIndex({ name, type: "vectorSearch", definition });
    ready.push(`${collectionName}.${name} (created, building)`);
  }
  return ready;
};

const run = async () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error("MONGODB_URI is required");

  configureMongoDns();
  await mongoose.connect(mongodbUri);
  try {
    const database = mongoose.connection.db;
    console.log(`AI-001 indexes ready:\n  ${(await ensureAi001Indexes(database)).join("\n  ")}`);
    if (process.argv.includes("--vector")) {
      console.log(`AI-001 vector indexes:\n  ${(await ensureAi001VectorIndexes(database)).join("\n  ")}`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  run().catch((error) => {
    console.error("AI-001 index migration failed:", error.message);
    process.exitCode = 1;
  });
}
