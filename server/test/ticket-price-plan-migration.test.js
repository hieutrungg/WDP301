import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { SEAT_TYPES } from "../src/modules/room/room.constants.js";
import {
  COLLECTION,
  TICKET_PRICE_PLAN_INDEXES,
  TICKET_PRICE_PLAN_VALIDATOR,
  migrateTicketPricePlans,
} from "../src/migrations/20261018-ticket-price-plans.js";

const databaseFixture = ({ existing = null, indexes = [] } = {}) => {
  const writes = [];
  const database = {
    databaseName: "cinema_migration_test",
    listCollections(filter) {
      assert.deepEqual(filter, { name: COLLECTION });
      return {
        async next() {
          return existing;
        },
      };
    },
    collection(name) {
      assert.equal(
        name,
        COLLECTION,
        "Migration must never access other collections",
      );
      return {
        listIndexes() {
          return {
            async toArray() {
              return indexes;
            },
          };
        },
        async createIndex(fields, options) {
          writes.push({ operation: "createIndex", fields, options });
          return options.name;
        },
      };
    },
    async createCollection(name, options) {
      assert.equal(name, COLLECTION);
      writes.push({ operation: "createCollection", options });
    },
  };
  return { database, writes };
};

const compatibleCollection = () => ({
  type: "collection",
  options: {
    validator: structuredClone(TICKET_PRICE_PLAN_VALIDATOR),
    validationLevel: "strict",
    validationAction: "error",
  },
});

test("pricing migration defaults to an offline preview with zero DB operations", async () => {
  const plan = await migrateTicketPricePlans({
    databaseName: "cinema_migration_test",
  });
  assert.equal(plan.apply, false);
  assert.equal(plan.collection, COLLECTION);
});

test("pricing migration creates only the new collection and version uniqueness index", async () => {
  const fixture = databaseFixture();
  await migrateTicketPricePlans(fixture.database, { apply: true });
  assert.deepEqual(fixture.writes, [
    {
      operation: "createCollection",
      options: {
        validator: TICKET_PRICE_PLAN_VALIDATOR,
        validationLevel: "strict",
        validationAction: "error",
      },
    },
    { operation: "createIndex", ...TICKET_PRICE_PLAN_INDEXES[0] },
  ]);
});

test("pricing migration rerun reuses an equivalent index without replacing schema/data", async () => {
  const fixture = databaseFixture({
    existing: compatibleCollection(),
    indexes: [
      { name: "code_1_version_1", key: { code: 1, version: 1 }, unique: true },
    ],
  });
  await migrateTicketPricePlans(fixture.database, { apply: true });
  assert.deepEqual(fixture.writes, [
    {
      operation: "createIndex",
      fields: { code: 1, version: 1 },
      options: { unique: true, name: "code_1_version_1" },
    },
  ]);
});

test("pricing migration refuses an existing incompatible validator before any writes", async () => {
  const existing = compatibleCollection();
  existing.options.validator = {};
  const fixture = databaseFixture({ existing });
  await assert.rejects(
    migrateTicketPricePlans(fixture.database, { apply: true }),
    /different validator/,
  );
  assert.deepEqual(fixture.writes, []);
});

test("pricing migration refuses non-unique or partial indexes without dropping them", async () => {
  for (const options of [
    {},
    { unique: true, partialFilterExpression: { status: "ACTIVE" } },
  ]) {
    const fixture = databaseFixture({
      existing: compatibleCollection(),
      indexes: [
        { name: "code_1_version_1", key: { code: 1, version: 1 }, ...options },
      ],
    });
    await assert.rejects(
      migrateTicketPricePlans(fixture.database, { apply: true }),
      /Incompatible index/,
    );
    assert.deepEqual(fixture.writes, []);
  }
});

test("pricing schema covers exactly the current physical seat classifications", () => {
  assert.deepEqual(
    Object.keys(
      TICKET_PRICE_PLAN_VALIDATOR.$jsonSchema.properties.seatTypePrices
        .properties,
    ).sort(),
    [...SEAT_TYPES].sort(),
  );
});

const testUri = process.env.MONGODB_TEST_URI?.trim();

test(
  "MongoDB enforces ticket price money, required types and version uniqueness",
  {
    skip:
      !testUri &&
      "MONGODB_TEST_URI is not configured; Atlas migration was not executed",
  },
  async () => {
    const uriDatabase = testUri.split("?")[0].split("/").at(-1);
    assert.match(
      uriDatabase,
      /test/i,
      "Use a dedicated test URI, never the development database",
    );
    const databaseName = `cinema_pricing_test_${randomUUID().replaceAll("-", "")}`;
    const connection = mongoose.createConnection();
    try {
      await connection.openUri(testUri, {
        dbName: databaseName,
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 10000,
      });
      const database = connection.db;
      await migrateTicketPricePlans(database, { apply: true });
      const plans = database.collection(COLLECTION);
      const document = {
        code: "DEFAULT",
        name: "Test prices",
        version: 1,
        status: "DRAFT",
        currency: "VND",
        seatTypePrices: { STANDARD: 90000, VIP: 120000, DOUBLE_LUXURY: 180000 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await plans.insertOne(structuredClone(document));
      await migrateTicketPricePlans(database, { apply: true });
      assert.equal(
        await plans.countDocuments(),
        1,
        "Rerun must preserve plan data",
      );
      await assert.rejects(
        plans.insertOne(structuredClone(document)),
        (error) => error.code === 11000,
      );
      await plans.insertOne({ ...structuredClone(document), version: 2 });
      for (const prices of [
        { STANDARD: 90000 },
        { ...document.seatTypePrices, VIP: -1 },
        { ...document.seatTypePrices, VIP: 1.5 },
        { ...document.seatTypePrices, VIP: Number.MAX_SAFE_INTEGER + 1 },
        { ...document.seatTypePrices, VIP: "120000" },
      ]) {
        await assert.rejects(
          plans.insertOne({
            ...structuredClone(document),
            code: "INVALID",
            seatTypePrices: prices,
          }),
          (error) => error.code === 121,
        );
      }
    } finally {
      try {
        if (connection.readyState === 1) {
          assert.equal(connection.db.databaseName, databaseName);
          await connection.db
            .collection(COLLECTION)
            .drop()
            .catch((error) => {
              if (error.code !== 26) throw error;
            });
        }
      } finally {
        await connection.close();
      }
    }
  },
);
