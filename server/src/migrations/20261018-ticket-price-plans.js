import "dotenv/config";
import { parseArgs, isDeepStrictEqual } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { configureMongoDns } from "../config/mongo-dns.js";

export const COLLECTION = "ticket_price_plans";

const money = () => ({
  bsonType: ["int", "long", "double", "decimal"],
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
  multipleOf: 1,
});

// Each document is one complete version. Publishing/version immutability must also be
// enforced by the future Pricing service; a Mongo validator cannot enforce transitions.
export const TICKET_PRICE_PLAN_VALIDATOR = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: [
      "code",
      "name",
      "version",
      "status",
      "currency",
      "seatTypePrices",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      _id: { bsonType: "objectId" },
      code: { bsonType: "string", pattern: "^[A-Z][A-Z0-9_-]{0,49}$" },
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      version: {
        bsonType: ["int", "long", "double", "decimal"],
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
        multipleOf: 1,
      },
      status: { enum: ["DRAFT", "ACTIVE", "RETIRED"] },
      currency: { enum: ["VND"] },
      seatTypePrices: {
        bsonType: "object",
        additionalProperties: false,
        required: ["STANDARD", "VIP", "DOUBLE_LUXURY"],
        properties: {
          STANDARD: money(),
          VIP: money(),
          DOUBLE_LUXURY: money(),
        },
      },
      createdBy: { bsonType: "objectId" },
      updatedBy: { bsonType: "objectId" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

export const TICKET_PRICE_PLAN_INDEXES = [
  {
    fields: { code: 1, version: 1 },
    options: { unique: true, name: "uniq_ticket_price_plan_code_version" },
  },
];

const assertCompatibleCollection = (info) => {
  if (
    info.type !== "collection" ||
    !isDeepStrictEqual(info.options?.validator, TICKET_PRICE_PLAN_VALIDATOR) ||
    (info.options?.validationLevel ?? "strict") !== "strict" ||
    (info.options?.validationAction ?? "error") !== "error"
  ) {
    throw new Error(
      "Existing ticket_price_plans has a different validator/type. Review it separately; this migration will not overwrite it.",
    );
  }
};

export const migrateTicketPricePlans = async (
  database,
  { apply = false } = {},
) => {
  const plan = {
    database: database.databaseName,
    collection: COLLECTION,
    apply,
    validator: TICKET_PRICE_PLAN_VALIDATOR,
    indexes: TICKET_PRICE_PLAN_INDEXES,
  };
  if (!apply) return plan;

  const findCollection = () =>
    database.listCollections({ name: COLLECTION }, { nameOnly: false }).next();
  const existing = await findCollection();
  if (existing) assertCompatibleCollection(existing);

  const collection = database.collection(COLLECTION);
  const indexes = existing ? await collection.listIndexes().toArray() : [];
  for (const { fields, options } of TICKET_PRICE_PLAN_INDEXES) {
    for (const index of indexes) {
      const sameKey = isDeepStrictEqual(index.key, fields);
      const sameName = index.name === options.name;
      if (
        (sameKey || sameName) &&
        (!sameKey ||
          index.unique !== true ||
          index.sparse ||
          index.partialFilterExpression ||
          index.collation)
      ) {
        throw new Error(
          `Incompatible index ${index.name}; no indexes were dropped or replaced.`,
        );
      }
    }
  }

  if (!existing) {
    try {
      await database.createCollection(COLLECTION, {
        validator: TICKET_PRICE_PLAN_VALIDATOR,
        validationLevel: "strict",
        validationAction: "error",
      });
    } catch (error) {
      if (error.code !== 48) throw error;
      assertCompatibleCollection(await findCollection());
    }
  }

  for (const { fields, options } of TICKET_PRICE_PLAN_INDEXES) {
    const equivalent = indexes.find((index) =>
      isDeepStrictEqual(index.key, fields),
    );
    await collection.createIndex(fields, {
      ...options,
      name: equivalent?.name ?? options.name,
    });
  }
  return plan;
};

const run = async () => {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      database: { type: "string" },
    },
  });
  if (values.apply && values["dry-run"]) {
    throw new Error("Choose --apply or --dry-run, not both");
  }
  const databaseName = values.database?.trim();
  if (!databaseName || /[/\\.\s"$]/.test(databaseName)) {
    throw new Error(
      "Specify an explicit valid database with --database <name>",
    );
  }
  if (!values.apply) {
    const plan = await migrateTicketPricePlans({ databaseName });
    console.log(JSON.stringify(plan, null, 2));
    console.log(
      "Offline preview only. No Atlas connection or writes were made. Use --apply to execute.",
    );
    return;
  }

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is required in server/.env");
  configureMongoDns();
  const connection = mongoose.createConnection();
  try {
    await connection.openUri(uri, {
      dbName: databaseName,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 10000,
    });
    await migrateTicketPricePlans(connection.db, { apply: true });
    console.log(
      `${databaseName}.${COLLECTION}: validator and indexes ready. No plans inserted; existing collections were not modified.`,
    );
  } finally {
    await connection.close();
  }
};

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  run().catch((error) => {
    // Connection errors may contain URI details; print only operational messages for DNS/network failures.
    const isNetworkError =
      error.name === "MongooseServerSelectionError" ||
      /ECONNREFUSED|ENOTFOUND|ETIMEOUT|querySrv/.test(error.message);
    console.error(
      isNetworkError
        ? "Cannot connect to MongoDB. Check DNS/network and Atlas access."
        : error.message,
    );
    process.exitCode = 1;
  });
}
