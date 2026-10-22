import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";
import { ROOM_NAME_COLLATION } from "../modules/room/room.constants.js";

// ROOM-001 (PROPOSED): room names are unique per branch after normalization (case-insensitive).
// Creates `uniq_room_branch_name_normalized` on `rooms`. No backfill and no data is rewritten.
// Safe to re-run. It never drops or replaces an existing index. Because a unique index cannot be
// built over duplicates, it first lists any room names that already collide and stops without
// writing; rename or merge those rooms, then run it again.

export const ROOM_NAME_INDEX = Object.freeze({
  fields: { branchId: 1, roomName: 1 },
  options: { unique: true, collation: ROOM_NAME_COLLATION, name: "uniq_room_branch_name_normalized" },
});

const normalizeName = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const listIndexes = async (collection) => {
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (error.code !== 26) throw error; // The collection does not exist yet.
    return [];
  }
};

export const findDuplicateRoomNames = async (collection) => {
  const groups = new Map();

  for await (const room of collection.find({}, { projection: { branchId: 1, roomName: 1 } })) {
    const key = `${room.branchId}:${normalizeName(room.roomName)}`;
    groups.set(key, [...(groups.get(key) ?? []), room]);
  }

  return [...groups.values()].filter((rooms) => rooms.length > 1);
};

export const ensureRoomIndexes = async (database) => {
  const collection = database.collection("rooms");
  const existing = (await listIndexes(collection)).find(({ name }) => name === ROOM_NAME_INDEX.options.name);

  if (existing) {
    if (existing.unique !== true) {
      throw new Error(`Incompatible index ${existing.name} on rooms; no indexes were dropped or replaced.`);
    }
    return [`rooms.${existing.name}`];
  }

  const duplicates = await findDuplicateRoomNames(collection);
  if (duplicates.length > 0) {
    const detail = duplicates
      .map((rooms) => `${rooms.map(({ _id, roomName }) => `${_id} "${roomName}"`).join(", ")}`)
      .join("; ");
    throw new Error(`Duplicate room names in the same branch must be resolved first: ${detail}`);
  }

  return [`rooms.${await collection.createIndex(ROOM_NAME_INDEX.fields, ROOM_NAME_INDEX.options)}`];
};

const run = async () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  if (!mongodbUri) throw new Error("MONGODB_URI is required");

  configureMongoDns();
  await mongoose.connect(mongodbUri);
  try {
    const indexes = await ensureRoomIndexes(mongoose.connection.db);
    console.log(`ROOM-001 room indexes ready: ${indexes.join(", ")}`);
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  run().catch((error) => {
    console.error("ROOM-001 room index migration failed:", error.message);
    process.exitCode = 1;
  });
}
