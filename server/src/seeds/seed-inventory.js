import { branchSeeds } from "./seed-branches.js";
import { deterministicObjectId } from "./seed-utils.js";

// Idempotent development fixtures for UC39/UC40: catalog, suppliers, per-branch stock and the
// permission grants the screens need. Re-running never resets stock a developer already changed:
// quantities are written only when the inventory row is first created.

export const categorySeeds = [
  { seedKey: "concession-category:popcorn", name: "Popcorn", description: "Popcorn tubs and flavors" },
  { seedKey: "concession-category:snacks", name: "Snacks", description: "Hot and cold snacks" },
  { seedKey: "concession-category:drinks", name: "Drinks", description: "Soft drinks and bottled water" },
  { seedKey: "concession-category:packaging", name: "Packaging", description: "Cups, buckets and wrappers" },
];

// `stock` is [quantity, minThreshold] for branch index 0, 1, 2...; other branches reuse the last entry.
export const concessionSeeds = [
  { seedKey: "concession:hotdog", category: "popcorn", name: "Smoked Sausage Hotdog", size: "Single", unit: "serving", price: 75000, stock: [[0, 10], [14, 10]] },
  { seedKey: "concession:popcorn-bucket", category: "packaging", name: "Popcorn Paper Bucket 85oz", size: "Large", unit: "pack", price: 5000, stock: [[0, 50], [120, 50]] },
  { seedKey: "concession:cheese-popcorn", category: "popcorn", name: "Cheddar Cheese Popcorn", size: "Medium", unit: "tub", price: 59000, stock: [[3, 10], [8, 10]] },
  { seedKey: "concession:sweet-corn", category: "snacks", name: "Steamed Sweet Corn Cup", size: "12oz", unit: "cup", price: 35000, stock: [[4, 8], [30, 8]] },
  { seedKey: "concession:milo", category: "drinks", name: "Milo Chocolate Malt Drink", size: "16oz", unit: "cup", price: 39000, stock: [[6, 10], [55, 10]] },
  { seedKey: "concession:caramel-popcorn", category: "popcorn", name: "Caramel Popcorn", size: "Large", unit: "tub", price: 65000, stock: [[18, 10], [40, 10]] },
  { seedKey: "concession:nachos", category: "snacks", name: "Nacho Supreme with Warm Cheese Dip", size: "Tray", unit: "tray", price: 69000, stock: [[14, 8], [22, 8]] },
  { seedKey: "concession:cola", category: "drinks", name: "Fountain Soda (Coca-Cola)", size: "32oz", unit: "cup", price: 36000, stock: [[85, 20], [90, 20]] },
  { seedKey: "concession:water", category: "drinks", name: "Dasani Pure Mineral Water", size: "500ml", unit: "bottle", price: 22000, stock: [[110, 30], [100, 30]] },
  { seedKey: "concession:never-stocked", category: "snacks", name: "Churros Cinnamon Sticks", size: "6 pcs", unit: "box", price: 45000, stock: null },
];

export const supplierSeeds = [
  { seedKey: "supplier:vissan", name: "Vissan Meat & Deli Foods", email: "sales@vissan.example", phone: "0281234001", address: "420 No Trang Long, Binh Thanh, Ho Chi Minh City" },
  { seedKey: "supplier:ecopack", name: "EcoPack Vietnam Industrial Packaging", email: "orders@ecopack.example", phone: "0281234002", address: "12 Tan Thuan, District 7, Ho Chi Minh City" },
  { seedKey: "supplier:beverage", name: "Coca-Cola Beverages Vietnam", email: "b2b@cocacola.example", phone: "0281234003", address: "485 Hanoi Highway, Thu Duc, Ho Chi Minh City" },
];

// inventory.view already exists in the base permission seed; stock_in is new for UC40.
export const permissionSeeds = [
  { name: "inventory.view", description: "View concession stock levels" },
  { name: "inventory.stock_in", description: "Receive goods into branch concession stock" },
];

export const roleGrantSeeds = [
  { role: "STAFF", permissions: ["inventory.view", "inventory.stock_in"] },
  { role: "MANAGER", permissions: ["inventory.view"] },
];

const upsertFixtures = async (database, collectionName, fixtures, toDocument) => {
  const result = await database.collection(collectionName).bulkWrite(
    fixtures.map((fixture) => {
      const _id = deterministicObjectId(fixture.seedKey);
      return {
        updateOne: {
          filter: { _id },
          update: { $set: toDocument(fixture), $setOnInsert: { _id } },
          upsert: true,
        },
      };
    }),
    { ordered: true },
  );
  return { matched: result.matchedCount, upserted: result.upsertedCount };
};

const stockForBranch = (stock, branchIndex) => stock?.[Math.min(branchIndex, stock.length - 1)];

export const seedInventory = async (database) => {
  const now = new Date();

  const categories = await upsertFixtures(database, "concession_categories", categorySeeds, ({ name, description }) => ({
    name,
    description,
  }));

  const concessions = await upsertFixtures(
    database,
    "concessions",
    concessionSeeds,
    ({ category, name, size, unit, price }) => ({
      categoryId: deterministicObjectId(`concession-category:${category}`),
      name,
      size,
      unit,
      price,
      status: "ACTIVE",
    }),
  );

  const suppliers = await upsertFixtures(database, "suppliers", supplierSeeds, ({ name, email, phone, address }) => ({
    name,
    email,
    phone,
    address,
  }));

  const inventoryOperations = branchSeeds
    .filter(({ status }) => status === "ACTIVE")
    .flatMap(({ seedKey: branchSeedKey }, branchIndex) =>
      concessionSeeds
        .filter(({ stock }) => stock)
        .map(({ seedKey, stock }) => {
          const [quantity, minThreshold] = stockForBranch(stock, branchIndex);
          const branchId = deterministicObjectId(branchSeedKey);
          const concessionId = deterministicObjectId(seedKey);

          return {
            updateOne: {
              filter: { branchId, concessionId },
              update: {
                $setOnInsert: { branchId, concessionId, quantity, minThreshold, updatedAt: now },
              },
              upsert: true,
            },
          };
        }),
    );
  const inventoryResult = await database
    .collection("inventories")
    .bulkWrite(inventoryOperations, { ordered: true });

  const permissionIds = {};
  for (const { name, description } of permissionSeeds) {
    const permission = await database
      .collection("permissions")
      .findOneAndUpdate(
        { name },
        { $setOnInsert: { name, description } },
        { upsert: true, returnDocument: "after" },
      );
    permissionIds[name] = permission._id;
  }

  const grants = {};
  for (const { role, permissions } of roleGrantSeeds) {
    const result = await database
      .collection("roles")
      .updateOne(
        { name: role },
        { $addToSet: { permissionIds: { $each: permissions.map((name) => permissionIds[name]) } } },
      );
    grants[role] = result.matchedCount === 1 ? "granted" : "role not found";
  }

  return {
    categories,
    concessions,
    suppliers,
    inventories: { matched: inventoryResult.matchedCount, upserted: inventoryResult.upsertedCount },
    grants,
  };
};
