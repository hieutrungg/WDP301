import { Inventory } from "./inventory.model.js";

// Owner: Inventory (Nam). Consumer: CON-101. This is an advisory on-hand read, not a
// reservation/checkout contract. It does not grant public access to the Inventory HTTP API.
export const readSellableStock = async ({ branchId, concessionIds }) => {
  const isId = (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
  if (
    !isId(branchId) ||
    !Array.isArray(concessionIds) ||
    concessionIds.length > 500 ||
    !concessionIds.every(isId)
  ) {
    throw new TypeError(
      "Stock read requires a branch and at most 500 valid concession IDs",
    );
  }
  const ids = [...new Set(concessionIds.map((id) => id.toLowerCase()))];
  const result = new Map(ids.map((id) => [id, { quantity: 0 }]));
  if (ids.length === 0) return result;
  const rows = await Inventory.find({ branchId, concessionId: { $in: ids } })
    .select({ _id: 0, concessionId: 1, quantity: 1 })
    .lean();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.quantity) || row.quantity < 0) {
      throw new Error("Invalid inventory quantity in catalog stock read");
    }
    result.set(row.concessionId.toString(), { quantity: row.quantity });
  }
  return result;
};
