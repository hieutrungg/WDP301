import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";

test(
  "CON-101 public catalog Mongo/HTTP contract",
  { skip: !process.env.MONGODB_URI },
  async (t) => {
    const dbName = `cinema_con101_test_${process.pid}_${Date.now()}`;
    let server;
    let db;
    try {
      configureMongoDns();
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName,
        autoCreate: false,
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
      });
      db = mongoose.connection.db;
      assert.equal(db.databaseName, dbName);
      const { default: app } = await import("../src/app.js");
      const { Inventory } =
        await import("../src/modules/inventory/inventory.model.js");
      const { Concession } =
        await import("../src/modules/inventory/concession.model.js");
      const { readSellableStock } =
        await import("../src/modules/inventory/stock-read.service.js");
      const ids = Object.fromEntries(
        [
          "a",
          "b",
          "inactiveBranch",
          "category",
          "emptyCategory",
          "hiddenCategory",
          "popcorn",
          "cola",
          "free",
          "out",
          "missingPrice",
          "inactive",
          "packaging",
          "neverStocked",
          "hiddenOnly",
          "combo",
          "freeCombo",
          "inactiveCombo",
          "missingPriceCombo",
        ].map((key) => [key, new mongoose.Types.ObjectId()]),
      );
      const oid = () => new mongoose.Types.ObjectId();
      await db.collection("branches").insertMany([
        { _id: ids.a, branchName: "Catalog A", status: "ACTIVE" },
        { _id: ids.b, branchName: "Catalog B", status: "ACTIVE" },
        { _id: ids.inactiveBranch, branchName: "Closed", status: "INACTIVE" },
      ]);
      await db.collection("concession_categories").insertMany([
        {
          _id: ids.category,
          name: "Food",
          description: "Food category",
          supplierId: "private",
        },
        { _id: ids.emptyCategory, name: "Empty" },
        { _id: ids.hiddenCategory, name: "Hidden" },
      ]);
      const item = (key, values = {}) => ({
        _id: ids[key],
        categoryId: ids.category,
        name: key,
        status: "ACTIVE",
        price: 10000,
        supplierId: "private supplier",
        stockLedger: [{ private: true }],
        quantity: 999999,
        ...values,
      });
      const invalidPrices = [
        null,
        "0",
        "1000",
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
        NaN,
        Infinity,
      ];
      const invalidPriceItems = invalidPrices.map((price) => ({
        ...item("popcorn", { price }),
        _id: oid(),
      }));
      const missing = item("missingPrice");
      delete missing.price;
      await db.collection("concessions").insertMany([
        item("popcorn", {
          name: "Bỏng ngô lớn — 200g",
          size: "200g",
          imageUrl: "https://example.com/popcorn.png",
        }),
        item("cola", { name: "Coca lớn — 700ml", size: "700ml" }),
        item("free", { price: 0 }),
        item("out"),
        missing,
        item("inactive", { status: "INACTIVE" }),
        item("packaging"),
        item("neverStocked"),
        item("hiddenOnly", {
          categoryId: ids.hiddenCategory,
          status: "INACTIVE",
        }),
        ...invalidPriceItems,
      ]);
      const level = (branchId, concessionId, quantity) => ({
        branchId,
        concessionId,
        quantity,
        minThreshold: 10,
      });
      await db
        .collection("inventories")
        .insertMany([
          level(ids.a, ids.popcorn, 4),
          level(ids.a, ids.cola, 1),
          level(ids.a, ids.free, 2),
          level(ids.a, ids.out, 0),
          level(ids.b, ids.popcorn, 1),
          level(ids.b, ids.cola, 4),
          level(ids.a, ids.inactive, 100),
          level(ids.a, ids.missingPrice, 100),
        ]);
      const recipe = [
        { concessionId: ids.popcorn, quantity: 1 },
        { concessionId: ids.cola, quantity: 2 },
      ];
      const combo = (key, values = {}) => ({
        _id: ids[key],
        name: key,
        status: "ACTIVE",
        price: 50000,
        items: recipe,
        supplier: "private",
        internal: "private",
        ...values,
      });
      const badRecipes = [
        [],
        null,
        "bad",
        [null],
        [{ concessionId: oid(), quantity: 1 }],
        [{ concessionId: ids.inactive, quantity: 1 }],
        [{ concessionId: ids.missingPrice, quantity: 1 }],
        [{ concessionId: ids.popcorn, quantity: 0 }],
        [{ concessionId: ids.popcorn, quantity: 1.5 }],
        [{ concessionId: ids.popcorn, quantity: "2" }],
        [
          { concessionId: ids.popcorn, quantity: 1 },
          { concessionId: ids.popcorn, quantity: 1 },
        ],
        [{ concessionId: "bad", quantity: 1 }],
      ];
      const malformedCombos = badRecipes.map((items, index) => ({
        ...combo("combo", { name: `bad-${index}`, items }),
        _id: oid(),
      }));
      const noPriceCombo = combo("missingPriceCombo");
      delete noPriceCombo.price;
      await db.collection("combos").insertMany([
        combo("combo"),
        combo("freeCombo", { price: 0 }),
        combo("inactiveCombo", { status: "INACTIVE" }),
        noPriceCombo,
        ...malformedCombos,
        ...invalidPrices.map((price) => ({
          ...combo("combo", { price }),
          _id: oid(),
        })),
      ]);
      await db
        .collection("stock_transactions")
        .insertOne({ note: "private ledger" });
      const snapshot = async () => {
        const names = [
          "branches",
          "concession_categories",
          "concessions",
          "combos",
          "inventories",
          "stock_transactions",
        ];
        return Promise.all(
          names.map(async (name) => [
            name,
            await db.collection(name).find().sort({ _id: 1 }).toArray(),
          ]),
        );
      };
      const before = await snapshot();
      await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
      });
      const root = `http://127.0.0.1:${server.address().port}/api`;
      const get = async (path, options) => {
        const response = await fetch(`${root}${path}`, options);
        return { status: response.status, body: await response.json() };
      };
      const branch = `branchId=${ids.a}`;

      await t.test(
        "Guest reads active priced items; zero is special and ACTIVE packaging follows owner policy",
        async () => {
          const { status, body } = await get(`/concessions?${branch}`);
          assert.equal(status, 200);
          assert.deepEqual(body.meta, {
            page: 1,
            limit: 20,
            total: 6,
            totalPages: 1,
          });
          assert.deepEqual(
            new Set(body.data.map((row) => row.id)),
            new Set(
              [
                "popcorn",
                "cola",
                "free",
                "out",
                "packaging",
                "neverStocked",
              ].map((key) => ids[key].toString()),
            ),
          );
          const free = body.data.find((row) => row.id === ids.free.toString());
          assert.equal(free.price, 0);
          assert.equal(free.isSpecialOffer, true);
          assert.equal(free.available, true);
          assert.equal(free.description, null);
          assert.equal(free.imageUrl, null);
          assert.equal(free.size, null);
          assert.deepEqual(
            Object.keys(free).sort(),
            [
              "id",
              "category",
              "name",
              "description",
              "size",
              "imageUrl",
              "price",
              "branchId",
              "available",
              "isSpecialOffer",
            ].sort(),
          );
          assert.deepEqual(free.category, {
            id: ids.category.toString(),
            name: "Food",
          });
        },
      );
      await t.test(
        "out-of-stock and never-stocked products remain visible; availability is branch-specific",
        async () => {
          for (const key of ["out", "neverStocked"]) {
            const result = await get(`/concessions/${ids[key]}?${branch}`);
            assert.equal(result.status, 200);
            assert.equal(result.body.data.available, false);
          }
          assert.equal(
            (await get(`/concessions/${ids.free}?branchId=${ids.b}`)).body.data
              .available,
            false,
          );
          assert.equal(
            (await get(`/concessions/${ids.free}?branchId=${ids.b}`)).body.data
              .isSpecialOffer,
            true,
          );
          const upper = await get(
            `/concessions/${ids.popcorn.toString().toUpperCase()}?branchId=${ids.a.toString().toUpperCase()}`,
          );
          assert.equal(upper.status, 200);
          assert.equal(upper.body.data.branchId, ids.a.toString());
        },
      );
      await t.test(
        "missing/inactive/invalid-price item and combo details return the same safe 404",
        async () => {
          for (const id of [
            ids.inactive,
            ids.missingPrice,
            oid(),
            ...invalidPriceItems.map((row) => row._id),
          ]) {
            const result = await get(`/concessions/${id}?${branch}`);
            assert.equal(result.status, 404);
            assert.equal(result.body.code, "CONCESSION_NOT_FOUND");
          }
          for (const id of [ids.inactiveCombo, ids.missingPriceCombo, oid()]) {
            const result = await get(`/combos/${id}?${branch}`);
            assert.equal(result.status, 404);
            assert.equal(result.body.code, "COMBO_NOT_FOUND");
          }
        },
      );
      await t.test(
        "categories exclude empty and hidden-only categories and expose no internal fields",
        async () => {
          const result = await get("/concession-categories");
          assert.equal(result.status, 200);
          assert.deepEqual(result.body.data, [
            {
              id: ids.category.toString(),
              name: "Food",
              description: "Food category",
            },
          ]);
          assert.equal(result.body.meta.total, 1);
        },
      );
      await t.test(
        "pagination totals, empty pages and existing empty category are correct",
        async () => {
          const page1 = await get(`/concessions?${branch}&page=1&limit=2`);
          const page2 = await get(`/concessions?${branch}&page=2&limit=2`);
          assert.deepEqual(page1.body.meta, {
            page: 1,
            limit: 2,
            total: 6,
            totalPages: 3,
          });
          assert.equal(page1.body.data.length, 2);
          assert.equal(page2.body.data.length, 2);
          assert.equal(
            new Set(
              [...page1.body.data, ...page2.body.data].map((row) => row.id),
            ).size,
            4,
          );
          assert.deepEqual(
            (await get(`/concessions?${branch}&page=100`)).body.data,
            [],
          );
          const empty = await get(
            `/concessions?${branch}&categoryId=${ids.emptyCategory}`,
          );
          assert.equal(empty.status, 200);
          assert.deepEqual(empty.body.data, []);
          assert.equal(empty.body.meta.totalPages, 0);
          const absent = await get(
            `/concessions?${branch}&categoryId=${oid()}`,
          );
          assert.equal(absent.status, 404);
          assert.equal(absent.body.code, "CONCESSION_CATEGORY_NOT_FOUND");
        },
      );
      await t.test(
        "every branch-scoped endpoint rejects inactive/missing branches",
        async () => {
          for (const path of [
            "/concessions",
            `/concessions/${ids.popcorn}`,
            "/combos",
            `/combos/${ids.combo}`,
          ]) {
            for (const branchId of [ids.inactiveBranch, oid()]) {
              const result = await get(`${path}?branchId=${branchId}`);
              assert.equal(result.status, 404);
              assert.equal(result.body.code, "BRANCH_NOT_FOUND");
            }
          }
        },
      );
      await t.test(
        "HTTP validates IDs and rejects unsupported/repeated/structured queries",
        async () => {
          for (const path of [
            "/concessions",
            "/combos",
            `/concessions/${ids.popcorn}`,
            `/combos/${ids.combo}`,
          ]) {
            assert.equal((await get(path)).status, 400);
            assert.equal(
              (await get(`${path}?branchId=bad`)).body.code,
              "INVALID_QUERY",
            );
            assert.equal(
              (await get(`${path}?${branch}&branchId=${ids.b}`)).status,
              400,
            );
            assert.equal((await get(`${path}?branchId[$ne]=x`)).status, 400);
          }
          for (const suffix of [
            "categoryId=bad",
            "limit=101",
            "page=0",
            "page=1&page=2",
            "limit=20&limit=20",
            "q=x",
            "status=INACTIVE",
            "categoryId[$ne]=x",
            "limit=1e2",
          ]) {
            const result = await get(`/concessions?${branch}&${suffix}`);
            assert.equal(result.status, 400, suffix);
            assert.equal(result.body.code, "INVALID_QUERY");
          }
          assert.equal(
            (await get(`/concessions/bad?${branch}`)).body.code,
            "INVALID_CONCESSION_ID",
          );
          assert.equal(
            (await get(`/combos/bad?${branch}`)).body.code,
            "INVALID_COMBO_ID",
          );
          assert.equal(
            (await get("/concession-categories?limit=101")).status,
            400,
          );
        },
      );
      await t.test(
        "combo availability uses each component quantity at the selected branch",
        async () => {
          const a = await get(`/combos/${ids.combo}?${branch}`);
          const b = await get(`/combos/${ids.combo}?branchId=${ids.b}`);
          assert.equal(a.status, 200);
          assert.equal(a.body.data.available, false);
          assert.equal(b.status, 200);
          assert.equal(b.body.data.available, true);
          assert.equal(b.body.data.price, 50000); // Stored price, not component price sum.
          assert.deepEqual(
            b.body.data.items.map((row) => row.quantity),
            [1, 2],
          );
          assert.equal(b.body.data.imageUrl, null);
          const free = await get(`/combos/${ids.freeCombo}?branchId=${ids.b}`);
          assert.equal(free.body.data.isSpecialOffer, true);
          assert.equal(free.body.data.price, 0);
          assert.deepEqual(
            Object.keys(b.body.data).sort(),
            [
              "id",
              "name",
              "description",
              "imageUrl",
              "price",
              "branchId",
              "available",
              "isSpecialOffer",
              "items",
            ].sort(),
          );
          assert.deepEqual(
            Object.keys(b.body.data.items[0]).sort(),
            ["concessionId", "name", "size", "quantity"].sort(),
          );
        },
      );
      await t.test(
        "legacy malformed, missing, inactive or unpriced combo components fail closed",
        async () => {
          for (const combo of malformedCombos) {
            const result = await get(`/combos/${combo._id}?${branch}`);
            assert.equal(result.status, 200);
            assert.equal(result.body.data.available, false, combo.name);
            assert.deepEqual(result.body.data.items, []);
          }
          const result = await get(`/combos?${branch}&limit=100`);
          assert.equal(result.status, 200);
          assert.equal(result.body.meta.total, 2 + malformedCombos.length);
        },
      );
      await t.test(
        "stock boundary is branch-scoped, deduplicated and uses zero for absent rows",
        async () => {
          const levels = await readSellableStock({
            branchId: ids.a.toString(),
            concessionIds: [
              ids.popcorn.toString(),
              ids.popcorn.toString().toUpperCase(),
              ids.neverStocked.toString(),
            ],
          });
          assert.equal(levels.size, 2);
          assert.deepEqual(levels.get(ids.popcorn.toString()), { quantity: 4 });
          assert.deepEqual(levels.get(ids.neverStocked.toString()), {
            quantity: 0,
          });
        },
      );
      await t.test(
        "reads do not mutate inventory, catalog, branch or ledger and do not expose protected inventory",
        async () => {
          assert.deepEqual(await snapshot(), before);
          assert.equal((await get("/inventory/stock-levels")).status, 401);
          assert.equal((await get("/inventory/suppliers")).status, 401);
          assert.equal(
            (
              await get("/concessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              })
            ).status,
            404,
          );
        },
      );
      await t.test(
        "empty catalogs return 200 with empty data and zero totals",
        async () => {
          // Only task-specific test fixtures are changed here.
          await db
            .collection("concessions")
            .updateMany({}, { $set: { status: "INACTIVE" } });
          await db
            .collection("combos")
            .updateMany({}, { $set: { status: "INACTIVE" } });
          for (const path of [
            "/concession-categories",
            `/concessions?${branch}`,
            `/combos?${branch}`,
          ]) {
            const result = await get(path);
            assert.equal(result.status, 200);
            assert.deepEqual(result.body.data, []);
            assert.deepEqual(result.body.meta, {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            });
          }
        },
      );
      await t.test(
        "operational failures remain sanitized 500 responses, never available/empty success",
        async () => {
          await db
            .collection("concessions")
            .updateOne({ _id: ids.popcorn }, { $set: { status: "ACTIVE" } });
          const originalFind = Inventory.find;
          const originalAggregate = Concession.aggregate;
          const originalError = console.error;
          const logs = [];
          console.error = (...args) => logs.push(args);
          try {
            Inventory.find = () => {
              throw new Error("private database failure");
            };
            const stockFailure = await get(
              `/concessions/${ids.popcorn}?${branch}`,
            );
            assert.equal(stockFailure.status, 500);
            assert.equal(stockFailure.body.message, "Internal server error");
            Inventory.find = originalFind;
            Concession.aggregate = () => {
              throw new Error("private catalog failure");
            };
            const catalogFailure = await get(`/concessions?${branch}`);
            assert.equal(catalogFailure.status, 500);
            assert.equal(catalogFailure.body.success, false);
            assert.equal(catalogFailure.body.message, "Internal server error");
            assert.equal(logs.length, 2);
          } finally {
            Inventory.find = originalFind;
            Concession.aggregate = originalAggregate;
            console.error = originalError;
          }
        },
      );
      await t.test(
        "legacy integer BSON prices stay readable without data migration",
        async () => {
          const decimal = mongoose.mongo.Decimal128.fromString;
          const validId = oid();
          const invalidId = oid();
          const comboId = oid();
          const invalidComponentComboId = oid();
          await db.collection("concessions").insertMany([
            {
              _id: validId,
              name: "Decimal price",
              status: "ACTIVE",
              categoryId: ids.emptyCategory,
              price: decimal("20000"),
            },
            {
              _id: invalidId,
              name: "Fractional decimal",
              status: "ACTIVE",
              categoryId: ids.emptyCategory,
              price: decimal("1.0000000000000000001"),
            },
          ]);
          await db
            .collection("inventories")
            .insertMany([level(ids.a, validId, 2), level(ids.a, invalidId, 2)]);
          await db.collection("combos").insertMany([
            {
              _id: comboId,
              name: "Decimal zero",
              status: "ACTIVE",
              price: decimal("0"),
              items: [{ concessionId: validId, quantity: 2 }],
            },
            {
              _id: invalidComponentComboId,
              name: "Invalid decimal component",
              status: "ACTIVE",
              price: 100,
              items: [{ concessionId: invalidId, quantity: 1 }],
            },
          ]);
          const listing = await get(
            `/concessions?${branch}&categoryId=${ids.emptyCategory}`,
          );
          assert.equal(listing.status, 200);
          assert.equal(listing.body.meta.total, 1);
          assert.equal(listing.body.data[0].price, 20000);
          const valid = await get(`/combos/${comboId}?${branch}`);
          assert.equal(valid.status, 200);
          assert.equal(valid.body.data.available, true);
          assert.equal(valid.body.data.price, 0);
          assert.equal(valid.body.data.isSpecialOffer, true);
          const invalid = await get(
            `/combos/${invalidComponentComboId}?${branch}`,
          );
          assert.equal(invalid.status, 200);
          assert.equal(invalid.body.data.available, false);
          assert.deepEqual(invalid.body.data.items, []);
        },
      );
      await t.test(
        "large combo pages split component reads into bounded batches",
        async () => {
          await db
            .collection("combos")
            .updateMany({}, { $set: { status: "INACTIVE" } });
          const components = Array.from({ length: 501 }, (_, index) => ({
            _id: oid(),
            categoryId: ids.category,
            name: `Batch item ${index}`,
            status: "ACTIVE",
            price: 1,
          }));
          await db.collection("concessions").insertMany(components);
          await db
            .collection("inventories")
            .insertMany(components.map((item) => level(ids.a, item._id, 2)));
          await db.collection("combos").insertMany(
            [components.slice(0, 300), components.slice(300)].map(
              (rows, index) => ({
                name: `Batch combo ${index}`,
                status: "ACTIVE",
                price: 100,
                items: rows.map((row) => ({
                  concessionId: row._id,
                  quantity: 2,
                })),
              }),
            ),
          );
          const originalFind = Inventory.find;
          const batches = [];
          Inventory.find = function (filter, ...args) {
            batches.push(filter.concessionId.$in.length);
            return originalFind.call(this, filter, ...args);
          };
          try {
            const result = await get(`/combos?${branch}&limit=100`);
            assert.equal(result.status, 200);
            assert.equal(result.body.data.length, 2);
            assert.ok(result.body.data.every((row) => row.available));
            assert.deepEqual(batches, [500, 1]);
            assert.equal(
              result.body.data.reduce(
                (total, row) => total + row.items.length,
                0,
              ),
              501,
            );
          } finally {
            Inventory.find = originalFind;
          }
        },
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (
        db &&
        mongoose.connection.name === dbName &&
        dbName.startsWith("cinema_con101_test_")
      )
        await db.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
