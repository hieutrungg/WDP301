import assert from "node:assert/strict";
import { test } from "node:test";
import { branchSeeds } from "../src/seeds/seed-branches.js";
import {
  categorySeeds,
  concessionSeeds,
  permissionSeeds,
  roleGrantSeeds,
  seedInventory,
  supplierSeeds,
} from "../src/seeds/seed-inventory.js";
import { deterministicObjectId } from "../src/seeds/seed-utils.js";

const createFakeDatabase = () => {
  const writes = [];
  const grantCalls = [];

  const database = {
    writes,
    grantCalls,
    collection(name) {
      return {
        async bulkWrite(operations, options) {
          writes.push({ name, operations, options });
          return { matchedCount: 0, upsertedCount: operations.length };
        },
        async findOneAndUpdate(filter, update, options) {
          assert.equal(name, "permissions");
          assert.equal(options.upsert, true);
          assert.ok(update.$setOnInsert, "existing permissions are never overwritten");
          return { _id: deterministicObjectId(`permission:${filter.name}`), name: filter.name };
        },
        async updateOne(filter, update) {
          assert.equal(name, "roles");
          grantCalls.push({ filter, update });
          return { matchedCount: 1 };
        },
      };
    },
  };

  return database;
};

test("inventory fixtures use stable unique identities and valid references", () => {
  const keys = [...categorySeeds, ...concessionSeeds, ...supplierSeeds].map(({ seedKey }) => seedKey);
  assert.equal(new Set(keys).size, keys.length);

  const categoryKeys = new Set(categorySeeds.map(({ seedKey }) => seedKey));
  for (const { category } of concessionSeeds) {
    assert.ok(categoryKeys.has(`concession-category:${category}`), `unknown category ${category}`);
  }
});

test("inventory fixtures cover out-of-stock, low-stock, healthy and never-stocked items", () => {
  const stocks = concessionSeeds.filter(({ stock }) => stock).map(({ stock }) => stock[0]);

  assert.ok(stocks.some(([quantity]) => quantity === 0));
  assert.ok(stocks.some(([quantity, threshold]) => quantity > 0 && quantity <= threshold));
  assert.ok(stocks.some(([quantity, threshold]) => quantity > threshold));
  assert.ok(concessionSeeds.some(({ stock }) => stock === null));
});

test("inventory seed upserts by deterministic identity and never resets existing stock", async () => {
  const database = createFakeDatabase();
  const result = await seedInventory(database);

  const inventoryWrite = database.writes.find(({ name }) => name === "inventories");
  const activeBranches = branchSeeds.filter(({ status }) => status === "ACTIVE").length;
  const stockedItems = concessionSeeds.filter(({ stock }) => stock).length;

  assert.equal(inventoryWrite.operations.length, activeBranches * stockedItems);
  for (const { updateOne } of inventoryWrite.operations) {
    assert.equal(updateOne.upsert, true);
    assert.equal(updateOne.update.$set, undefined, "quantity is written on insert only");
    assert.ok(updateOne.update.$setOnInsert.quantity >= 0);
  }

  for (const name of ["concession_categories", "concessions", "suppliers"]) {
    const { operations } = database.writes.find((write) => write.name === name);
    assert.ok(operations.every(({ updateOne }) => updateOne.upsert === true));
  }

  assert.deepEqual(
    database.grantCalls.map(({ filter }) => filter.name),
    roleGrantSeeds.map(({ role }) => role),
  );
  for (const { update } of database.grantCalls) {
    assert.ok(update.$addToSet, "grants are additive and idempotent");
  }
  assert.deepEqual(result.grants, { STAFF: "granted", MANAGER: "granted" });
  assert.deepEqual(
    permissionSeeds.map(({ name }) => name),
    ["inventory.view", "inventory.stock_in"],
  );
});
