import mongoose from "mongoose";
import { Combo } from "./combo.model.js";

// Combo persistence belongs to this module. Single-item persistence remains behind the
// Inventory-owned exported adapter; no consumer imports Inventory models/repositories.
const publicMatch = () => ({
  status: "ACTIVE",
  $expr: {
    $cond: [
      { $in: [{ $type: "$price" }, ["int", "long", "double", "decimal"]] },
      {
        $and: [
          { $gte: ["$price", 0] },
          { $lte: ["$price", Number.MAX_SAFE_INTEGER] },
          { $eq: [{ $mod: ["$price", 1] }, 0] },
        ],
      },
      false,
    ],
  },
});
const projection = {
  _id: 1,
  name: 1,
  description: 1,
  items: 1,
  price: {
    $convert: { input: "$price", to: "double", onError: null, onNull: null },
  },
};

export const listCatalogCombos = async ({ skip, limit }) => {
  const [result] = await Combo.aggregate([
    { $match: publicMatch() },
    { $project: projection },
    { $sort: { _id: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "value" }],
      },
    },
  ]);
  return { items: result.items, total: result.total[0]?.value ?? 0 };
};

export const getCatalogCombo = async (comboId) =>
  (
    await Combo.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(comboId), ...publicMatch() },
      },
      { $project: projection },
    ])
  )[0] ?? null;
