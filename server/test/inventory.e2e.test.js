import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.EMAIL_TEST_MODE = "capture";

const password = "Cinema@2026";
const HOUR = 60 * 60 * 1000;

let baseUrl;
let server;
let models;
let branchA;
let branchB;
let items;
let supplier;
let cookies;

const request = async (path, { method = "GET", body, cookie } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
};

const signIn = async (identity) => {
  const { response } = await request("/auth/login", { method: "POST", body: { identity, password } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
};

const quantityOf = async (branchId, concessionId) =>
  (await models.Inventory.findOne({ branchId, concessionId }).lean())?.quantity ?? 0;

const stockIn = (body, cookie = cookies.staff) =>
  request("/inventory/stock-in", { method: "POST", cookie, body });

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_inventory_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  const [{ Account }, { Role }, { Permission }, inventoryModels, { default: app }] = await Promise.all([
    import("../src/modules/account/account.model.js"),
    import("../src/modules/role-permission/role.model.js"),
    import("../src/modules/role-permission/permission.model.js"),
    Promise.all([
      import("../src/modules/inventory/concession.model.js"),
      import("../src/modules/inventory/concession-category.model.js"),
      import("../src/modules/inventory/inventory.model.js"),
      import("../src/modules/inventory/stock-transaction.model.js"),
      import("../src/modules/inventory/supplier.model.js"),
    ]),
    import("../src/app.js"),
  ]);

  models = {
    Account,
    Concession: inventoryModels[0].Concession,
    ConcessionCategory: inventoryModels[1].ConcessionCategory,
    Inventory: inventoryModels[2].Inventory,
    StockTransaction: inventoryModels[3].StockTransaction,
    Supplier: inventoryModels[4].Supplier,
  };

  // Creates the collections and indexes up front; a transaction cannot rely on lazy creation.
  await Promise.all([
    Account.syncIndexes(),
    ...Object.values(models).filter((model) => model !== Account).map((model) => model.syncIndexes()),
  ]);

  const [view, stockInPermission] = await Permission.create([
    { name: "inventory.view", description: "View stock" },
    { name: "inventory.stock_in", description: "Receive goods" },
  ]);
  const [staffRole, managerRole, adminRole, customerRole] = await Role.create([
    { name: "STAFF", description: "Staff", permissionIds: [view._id, stockInPermission._id] },
    { name: "MANAGER", description: "Manager", permissionIds: [view._id] },
    // ADMIN holds every permission in the seed; the screens are still not Admin screens.
    { name: "ADMIN", description: "Admin", permissionIds: [view._id, stockInPermission._id] },
    { name: "CUSTOMER", description: "Customer", permissionIds: [] },
  ]);

  branchA = new mongoose.Types.ObjectId();
  branchB = new mongoose.Types.ObjectId();

  const createAccount = (username, roleIds, branchId) =>
    Account.create({
      username,
      email: `${username}@example.com`,
      passwordHash: bcrypt.hashSync(password, 4),
      roleIds,
      status: "ACTIVE",
      profile: { fullName: `Full ${username}` },
      ...(branchId ? { employeeProfile: { branchId, position: username } } : {}),
    });

  await Promise.all([
    createAccount("inv_staff", [staffRole._id], branchA),
    createAccount("inv_staff_b", [staffRole._id], branchB),
    createAccount("inv_staff_nobranch", [staffRole._id]),
    createAccount("inv_manager", [managerRole._id], branchA),
    createAccount("inv_admin", [adminRole._id], branchA),
    createAccount("inv_customer", [customerRole._id]),
  ]);

  const [popcorn, drinks] = await models.ConcessionCategory.create([{ name: "Popcorn" }, { name: "Drinks" }]);
  const concessions = await models.Concession.create([
    { categoryId: popcorn._id, name: "Caramel Popcorn", size: "Large", unit: "tub", price: 65000 },
    { categoryId: popcorn._id, name: "Cheese Popcorn", unit: "tub", price: 59000 },
    { categoryId: drinks._id, name: "Cola", unit: "cup", price: 36000 },
    { categoryId: drinks._id, name: "Water", unit: "bottle", price: 22000 },
    { categoryId: drinks._id, name: "Never Stocked Juice", unit: "bottle", price: 30000 },
    { categoryId: drinks._id, name: "Retired Soda", unit: "can", price: 20000, status: "INACTIVE" },
  ]);
  items = Object.fromEntries(
    concessions.map((concession) => [concession.name.split(" ")[0].toLowerCase(), concession]),
  );
  items.categoryPopcorn = popcorn;

  // branch A: caramel healthy (20/10), cheese low (3/10), cola at threshold (10/10), water out (0/10).
  await models.Inventory.create([
    { branchId: branchA, concessionId: items.caramel._id, quantity: 20, minThreshold: 10 },
    { branchId: branchA, concessionId: items.cheese._id, quantity: 3, minThreshold: 10 },
    { branchId: branchA, concessionId: items.cola._id, quantity: 10, minThreshold: 10 },
    { branchId: branchA, concessionId: items.water._id, quantity: 0, minThreshold: 10 },
    { branchId: branchB, concessionId: items.caramel._id, quantity: 999, minThreshold: 10 },
  ]);
  supplier = await models.Supplier.create({ name: "EcoPack", phone: "0281234002" });

  const listener = await new Promise((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  server = listener;
  baseUrl = `http://127.0.0.1:${listener.address().port}/api`;

  cookies = {
    staff: await signIn("inv_staff"),
    staffB: await signIn("inv_staff_b"),
    staffNoBranch: await signIn("inv_staff_nobranch"),
    manager: await signIn("inv_manager"),
    admin: await signIn("inv_admin"),
    customer: await signIn("inv_customer"),
  };
});

after(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("every inventory route is default-deny", async () => {
  for (const [method, path] of [
    ["GET", "/inventory/stock-levels"],
    ["GET", "/inventory/stock-levels/summary"],
    ["GET", "/inventory/categories"],
    ["GET", "/inventory/suppliers"],
    ["GET", "/inventory/stock-in"],
    ["POST", "/inventory/stock-in"],
  ]) {
    const anonymous = await request(path, { method });
    assert.equal(anonymous.response.status, 401, `${method} ${path} anonymous`);

    const customer = await request(path, { method, cookie: cookies.customer });
    assert.equal(customer.response.status, 403, `${method} ${path} customer`);

    // Admin holds the permissions but is not an actor of these screens.
    const admin = await request(path, { method, cookie: cookies.admin });
    assert.equal(admin.response.status, 403, `${method} ${path} admin`);
  }
});

test("Manager can read stock but cannot receive goods", async () => {
  const read = await request("/inventory/stock-levels", { cookie: cookies.manager });
  assert.equal(read.response.status, 200);

  const write = await stockIn({ items: [{ concessionId: items.caramel.id, quantity: 5 }] }, cookies.manager);
  assert.equal(write.response.status, 403);
  assert.equal(await quantityOf(branchA, items.caramel._id), 20);
});

test("staff without an assigned branch are refused", async () => {
  const read = await request("/inventory/stock-levels", { cookie: cookies.staffNoBranch });
  assert.equal(read.response.status, 403);
  assert.equal(read.body.code, "BRANCH_NOT_ASSIGNED");

  const write = await stockIn({ items: [{ concessionId: items.caramel.id, quantity: 5 }] }, cookies.staffNoBranch);
  assert.equal(write.response.status, 403);
  assert.equal(write.body.code, "BRANCH_NOT_ASSIGNED");
});

test("UC39 lists active items with derived stock status, out of stock first", async () => {
  const { response, body } = await request("/inventory/stock-levels", { cookie: cookies.staff });

  assert.equal(response.status, 200);
  assert.deepEqual(body.meta, { page: 1, limit: 10, total: 5, totalPages: 1 });

  const byName = Object.fromEntries(body.data.map((row) => [row.name, row]));
  assert.equal(byName["Water"].stockStatus, "OUT_OF_STOCK");
  assert.equal(byName["Never Stocked Juice"].stockStatus, "OUT_OF_STOCK");
  assert.equal(byName["Never Stocked Juice"].quantity, 0);
  assert.equal(byName["Cheese Popcorn"].stockStatus, "LOW_STOCK");
  assert.equal(byName["Cola"].stockStatus, "LOW_STOCK", "at the threshold counts as low");
  assert.equal(byName["Caramel Popcorn"].stockStatus, "IN_STOCK");
  assert.equal(byName["Caramel Popcorn"].quantity, 20, "other branches' stock is not mixed in");
  assert.equal(byName["Caramel Popcorn"].unit, "tub");
  assert.equal(byName["Caramel Popcorn"].minThreshold, 10);
  assert.equal(byName["Caramel Popcorn"].category.name, "Popcorn");
  assert.equal(byName["Retired Soda"], undefined, "inactive items are not listed");

  assert.deepEqual(
    body.data.map((row) => row.stockStatus),
    ["OUT_OF_STOCK", "OUT_OF_STOCK", "LOW_STOCK", "LOW_STOCK", "IN_STOCK"],
  );
});

test("UC39 summary counts the whole branch", async () => {
  const { body } = await request("/inventory/stock-levels/summary", { cookie: cookies.staff });
  assert.deepEqual(body.data, { total: 5, inStock: 1, lowStock: 2, outOfStock: 2 });

  const other = await request("/inventory/stock-levels/summary", { cookie: cookies.staffB });
  assert.deepEqual(other.body.data, { total: 5, inStock: 1, lowStock: 0, outOfStock: 4 });
});

test("UC39 search, category and status filters, empty result and validation", async () => {
  const bySearch = await request("/inventory/stock-levels?q=popcorn", { cookie: cookies.staff });
  assert.deepEqual(bySearch.body.data.map(({ name }) => name).sort(), ["Caramel Popcorn", "Cheese Popcorn"]);

  const byCategory = await request(`/inventory/stock-levels?categoryId=${items.categoryPopcorn.id}`, {
    cookie: cookies.staff,
  });
  assert.equal(byCategory.body.meta.total, 2);

  const byStatus = await request("/inventory/stock-levels?status=OUT_OF_STOCK", { cookie: cookies.staff });
  assert.deepEqual(byStatus.body.data.map(({ name }) => name).sort(), ["Never Stocked Juice", "Water"]);

  const empty = await request("/inventory/stock-levels?q=nothing-matches-this", { cookie: cookies.staff });
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.body.data, []);
  assert.equal(empty.body.meta.total, 0);

  const paged = await request("/inventory/stock-levels?limit=2&page=2", { cookie: cookies.staff });
  assert.equal(paged.body.data.length, 2);
  assert.equal(paged.body.meta.totalPages, 3);

  for (const query of ["status=BROKEN", "categoryId=nope", "limit=500", "unknown=1"]) {
    const invalid = await request(`/inventory/stock-levels?${query}`, { cookie: cookies.staff });
    assert.equal(invalid.response.status, 400, query);
    assert.equal(invalid.body.code, "INVALID_QUERY", query);
  }
});

test("lookup lists return categories and suppliers", async () => {
  const categories = await request("/inventory/categories", { cookie: cookies.staff });
  assert.deepEqual(categories.body.data.map(({ name }) => name), ["Drinks", "Popcorn"]);

  const suppliers = await request("/inventory/suppliers", { cookie: cookies.staff });
  assert.equal(suppliers.body.data[0].name, "EcoPack");
});

test("UC40 rejects invalid input and leaves stock unchanged (BR-49)", async () => {
  const future = new Date(Date.now() + HOUR).toISOString();
  const cases = [
    ["zero quantity", { items: [{ concessionId: items.caramel.id, quantity: 0 }] }, 400],
    ["negative quantity", { items: [{ concessionId: items.caramel.id, quantity: -4 }] }, 400],
    ["fractional quantity", { items: [{ concessionId: items.caramel.id, quantity: 1.5 }] }, 400],
    ["string quantity", { items: [{ concessionId: items.caramel.id, quantity: "5" }] }, 400],
    ["missing quantity", { items: [{ concessionId: items.caramel.id }] }, 400],
    ["no items", { items: [] }, 400],
    ["missing items", {}, 400],
    ["duplicate lines", { items: [{ concessionId: items.caramel.id, quantity: 1 }, { concessionId: items.caramel.id, quantity: 2 }] }, 400],
    ["bad item id", { items: [{ concessionId: "xyz", quantity: 1 }] }, 400],
    ["bad received date", { items: [{ concessionId: items.caramel.id, quantity: 1 }], receivedAt: "yesterday" }, 400],
    ["future received date", { items: [{ concessionId: items.caramel.id, quantity: 1 }], receivedAt: future }, 400],
    ["note too long", { items: [{ concessionId: items.caramel.id, quantity: 1 }], note: "x".repeat(501) }, 400],
    ["unknown field", { items: [{ concessionId: items.caramel.id, quantity: 1 }], isAdmin: true }, 400],
    ["unknown item", { items: [{ concessionId: new mongoose.Types.ObjectId().toString(), quantity: 1 }] }, 404],
    ["inactive item", { items: [{ concessionId: items.retired.id, quantity: 1 }] }, 409],
    ["unknown supplier", { items: [{ concessionId: items.caramel.id, quantity: 1 }], supplierId: new mongoose.Types.ObjectId().toString() }, 404],
  ];

  for (const [label, body, status] of cases) {
    const result = await stockIn(body);
    assert.equal(result.response.status, status, `${label}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.success, false, label);
    assert.ok(result.body.code, `${label} has a stable error code`);
  }

  // A bad line in a multi-line receipt must not apply the good one.
  const mixed = await stockIn({
    items: [
      { concessionId: items.caramel.id, quantity: 5 },
      { concessionId: items.retired.id, quantity: 5 },
    ],
  });
  assert.equal(mixed.response.status, 409);

  assert.equal(await quantityOf(branchA, items.caramel._id), 20);
  assert.equal(await models.StockTransaction.countDocuments(), 0);
});

test("UC40 adds quantities, upserts never-stocked items and records the audit trail (BR-50)", async () => {
  const receivedAt = new Date(Date.now() - HOUR).toISOString();
  const { response, body } = await stockIn({
    items: [
      { concessionId: items.water.id, quantity: 48 },
      { concessionId: items.never.id, quantity: 12 },
    ],
    supplierId: supplier.id,
    receivedAt,
    note: "  Pallet 7, boxes intact  ",
  });

  assert.equal(response.status, 201, JSON.stringify(body));
  assert.match(body.data.receiptCode, /^RC-\d{8}-[0-9A-F]{6}$/);
  assert.deepEqual(
    body.data.items.map(({ name, quantityAdded, quantityAfter }) => ({ name, quantityAdded, quantityAfter })).sort((a, b) => a.name.localeCompare(b.name)),
    [
      { name: "Never Stocked Juice", quantityAdded: 12, quantityAfter: 12 },
      { name: "Water", quantityAdded: 48, quantityAfter: 48 },
    ],
  );

  assert.equal(await quantityOf(branchA, items.water._id), 48);
  assert.equal(await quantityOf(branchA, items.never._id), 12);
  assert.equal(await quantityOf(branchB, items.water._id), 0, "other branches are untouched");

  const created = await models.Inventory.findOne({ branchId: branchA, concessionId: items.never._id }).lean();
  assert.equal(created.minThreshold, 10, "new rows get the default threshold");

  const transactions = await models.StockTransaction.find({ receiptCode: body.data.receiptCode }).lean();
  assert.equal(transactions.length, 2);
  for (const transaction of transactions) {
    assert.equal(transaction.type, "IMPORT");
    assert.equal(transaction.branchId.toString(), branchA.toString());
    assert.equal(transaction.supplierId.toString(), supplier.id);
    assert.equal(transaction.transactionDate.toISOString(), receivedAt);
    assert.equal(transaction.note, "Pallet 7, boxes intact");
    assert.ok(transaction.recordedBy);
  }

  // The new quantities now show on UC39: water is healthy, the juice sits above its threshold.
  const levels = await request("/inventory/stock-levels?status=IN_STOCK", { cookie: cookies.staff });
  assert.ok(levels.body.data.some(({ name }) => name === "Water"));
});

test("UC40 history lists this branch's receipts newest first", async () => {
  await stockIn({ items: [{ concessionId: items.cheese.id, quantity: 2 }] });

  const { response, body } = await request("/inventory/stock-in", { cookie: cookies.staff });
  assert.equal(response.status, 200);
  assert.equal(body.meta.total, 3);
  assert.equal(body.data[0].concession.name, "Cheese Popcorn");
  assert.equal(body.data[0].recordedBy.name, "Full inv_staff");
  assert.equal(body.data[0].supplier, null);
  assert.equal(body.data[0].quantity, 2);

  const other = await request("/inventory/stock-in", { cookie: cookies.staffB });
  assert.equal(other.body.meta.total, 0);
});

test("a failed stock update rolls back every line (UC40 alternative sequence)", async () => {
  const before = {
    caramel: await quantityOf(branchA, items.caramel._id),
    cola: await quantityOf(branchA, items.cola._id),
    transactions: await models.StockTransaction.countDocuments(),
  };

  const originalInsertMany = models.StockTransaction.insertMany;
  models.StockTransaction.insertMany = async () => {
    throw new Error("simulated audit write failure");
  };

  try {
    const { response, body } = await stockIn({
      items: [
        { concessionId: items.caramel.id, quantity: 7 },
        { concessionId: items.cola.id, quantity: 7 },
      ],
    });

    assert.equal(response.status, 500);
    assert.equal(body.code, "STOCK_UPDATE_FAILED");
  } finally {
    models.StockTransaction.insertMany = originalInsertMany;
  }

  assert.equal(await quantityOf(branchA, items.caramel._id), before.caramel);
  assert.equal(await quantityOf(branchA, items.cola._id), before.cola);
  assert.equal(await models.StockTransaction.countDocuments(), before.transactions);
});

test("concurrent stock-ins never lose an update", async () => {
  const start = await quantityOf(branchA, items.caramel._id);

  const results = await Promise.all(
    Array.from({ length: 8 }, () => stockIn({ items: [{ concessionId: items.caramel.id, quantity: 1 }] })),
  );

  assert.deepEqual(results.map(({ response }) => response.status), Array(8).fill(201));
  assert.equal(await quantityOf(branchA, items.caramel._id), start + 8);
});
