import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { Combo } from "../src/modules/concession/combo.model.js";
import { parseComboRecipe } from "../src/modules/concession/concession.service.js";
import {
  categoriesQuery,
  concessionsQuery,
  combosQuery,
  detailQuery,
} from "../src/modules/concession/concession.validation.js";
import { readSellableStock } from "../src/modules/inventory/stock-read.service.js";
import { readCatalogConcessionsByIds } from "../src/modules/inventory/concession-catalog.read-service.js";

const id = "abcdef012345678901234567";
test("catalog queries require scalar ObjectIds and bounded positive integer pagination", () => {
  assert.deepEqual(concessionsQuery.parse({ branchId: id.toUpperCase() }), {
    branchId: id,
    page: 1,
    limit: 20,
  });
  for (const query of [
    {},
    { branchId: "bad" },
    { branchId: id, categoryId: "bad" },
    { branchId: [id] },
    { branchId: id, page: ["1"] },
    { branchId: id, limit: ["20"] },
    { branchId: id, page: "1.0" },
    { branchId: id, page: "1e2" },
    { branchId: id, page: "0" },
    { branchId: id, page: "9007199254740991" },
    { branchId: id, limit: "101" },
    { branchId: id, limit: "-1" },
    { branchId: id, status: "INACTIVE" },
    { branchId: id, q: "popcorn" },
    { branchId: id, categoryId: { $ne: null } },
  ])
    assert.equal(
      concessionsQuery.safeParse(query).success,
      false,
      JSON.stringify(query),
    );
  assert.equal(categoriesQuery.safeParse({ branchId: id }).success, false);
  assert.equal(
    combosQuery.safeParse({ branchId: id, categoryId: id }).success,
    false,
  );
  assert.equal(
    detailQuery.safeParse({ branchId: id, page: "1" }).success,
    false,
  );
});

test("combo recipes reject invalid legacy shapes, fractional quantities and duplicate IDs", () => {
  assert.deepEqual(
    parseComboRecipe([
      { concessionId: new mongoose.Types.ObjectId(id), quantity: 2 },
    ]),
    [{ concessionId: id, quantity: 2 }],
  );
  for (const recipe of [
    null,
    {},
    [],
    [null],
    [{ quantity: 1 }],
    [{ concessionId: "bad", quantity: 1 }],
    [{ concessionId: id, quantity: 0 }],
    [{ concessionId: id, quantity: -1 }],
    [{ concessionId: id, quantity: 1.5 }],
    [{ concessionId: id, quantity: "2" }],
    [{ concessionId: id, quantity: Number.MAX_SAFE_INTEGER + 1 }],
    [
      { concessionId: id, quantity: 1 },
      { concessionId: id.toUpperCase(), quantity: 2 },
    ],
  ])
    assert.equal(parseComboRecipe(recipe), null);
});

test("new Combo read model maps existing collection without automatic DDL", async () => {
  assert.equal(Combo.collection.name, "combos");
  assert.equal(Combo.schema.options.autoCreate, false);
  assert.equal(Combo.schema.options.autoIndex, false);
  assert.equal(Combo.schema.path("isPublic"), undefined);
  assert.ok(Combo.schema.path("imageUrl"));
  const base = {
    name: "Duo",
    price: 0,
    status: "ACTIVE",
    items: [{ concessionId: id, quantity: 2 }],
  };
  await new Combo(base).validate();
  for (const changes of [
    { price: -1 },
    { price: 1.5 },
    { status: "UNKNOWN" },
    { items: [] },
    {
      items: [
        { concessionId: id, quantity: 1 },
        { concessionId: id, quantity: 2 },
      ],
    },
    { items: [{ concessionId: id, quantity: 0 }] },
  ])
    await assert.rejects(new Combo({ ...base, ...changes }).validate());
});

test("exported read boundaries reject invalid or unbounded calls before persistence", async () => {
  assert.deepEqual(
    await readSellableStock({ branchId: id, concessionIds: [] }),
    new Map(),
  );
  assert.deepEqual(await readCatalogConcessionsByIds([]), []);
  await assert.rejects(
    readSellableStock({ branchId: "bad", concessionIds: [id] }),
    TypeError,
  );
  await assert.rejects(
    readSellableStock({ branchId: id, concessionIds: ["bad"] }),
    TypeError,
  );
  await assert.rejects(
    readSellableStock({ branchId: id, concessionIds: Array(501).fill(id) }),
    TypeError,
  );
  await assert.rejects(
    readCatalogConcessionsByIds(Array(501).fill(id)),
    TypeError,
  );
  await assert.rejects(readCatalogConcessionsByIds(["bad"]), TypeError);
});
