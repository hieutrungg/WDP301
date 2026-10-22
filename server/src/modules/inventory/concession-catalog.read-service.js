import mongoose from "mongoose";
import { Concession } from "./concession.model.js";
import { ConcessionCategory } from "./concession-category.model.js";
import { CONCESSION_STATUS } from "./inventory.constants.js";

// Inventory owns the existing catalog models. Consumers use this read adapter instead of
// importing those models/repositories. No stock or supplier fields leave this adapter.
export const CATALOG_READ_BATCH_SIZE = 500;

const catalogPriceMatch = () => ({
  // Guard $mod: legacy strings/null must be hidden, not trigger an aggregation error or become 0.
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

const publicMatch = () => ({
  status: CONCESSION_STATUS.ACTIVE,
  ...catalogPriceMatch(),
});
const toId = (id) => new mongoose.Types.ObjectId(id);
const pageStages = (skip, limit) => [
  { $sort: { _id: 1 } },
  {
    $facet: {
      items: [{ $skip: skip }, { $limit: limit }],
      total: [{ $count: "value" }],
    },
  },
];
const pageResult = ([result]) => ({
  items: result.items,
  total: result.total[0]?.value ?? 0,
});

const itemProjection = {
  _id: 1,
  categoryId: 1,
  name: 1,
  size: 1,
  price: {
    $convert: { input: "$price", to: "double", onError: null, onNull: null },
  },
  imageUrl: 1,
  status: 1,
};
const joinCategory = [
  {
    $lookup: {
      from: ConcessionCategory.collection.name,
      localField: "categoryId",
      foreignField: "_id",
      pipeline: [{ $project: { name: 1 } }],
      as: "category",
    },
  },
  { $set: { category: { $first: "$category" } } },
];

export const listCatalogCategories = async ({ skip, limit }) =>
  pageResult(
    await Concession.aggregate([
      { $match: publicMatch() },
      { $group: { _id: "$categoryId" } },
      {
        $lookup: {
          from: ConcessionCategory.collection.name,
          localField: "_id",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, description: 1 } }],
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $replaceWith: "$category" },
      ...pageStages(skip, limit),
    ]),
  );

export const catalogCategoryExists = async (categoryId) =>
  Boolean(await ConcessionCategory.exists({ _id: toId(categoryId) }));

export const listCatalogConcessions = async ({ categoryId, skip, limit }) =>
  pageResult(
    await Concession.aggregate([
      {
        $match: {
          ...publicMatch(),
          ...(categoryId ? { categoryId: toId(categoryId) } : {}),
        },
      },
      { $project: itemProjection },
      { $sort: { _id: 1 } },
      // Join only the bounded page, not the entire catalog.
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }, ...joinCategory],
          total: [{ $count: "value" }],
        },
      },
    ]),
  );

export const getCatalogConcession = async (concessionId) =>
  (
    await Concession.aggregate([
      { $match: { _id: toId(concessionId), ...publicMatch() } },
      { $project: itemProjection },
      ...joinCategory,
    ])
  )[0] ?? null;

export const readCatalogConcessionsByIds = async (ids) => {
  if (
    !Array.isArray(ids) ||
    ids.length > CATALOG_READ_BATCH_SIZE ||
    ids.some((id) => typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))
  ) {
    throw new TypeError(
      "Catalog read requires at most 500 valid concession IDs",
    );
  }
  if (ids.length === 0) return [];
  // Includes inactive/non-priced components so the catalog service can reject their eligibility.
  return Concession.aggregate([
    { $match: { _id: { $in: ids.map(toId) } } },
    {
      $project: {
        ...itemProjection,
        // Preserve invalid-price eligibility: do not coerce a legacy numeric string to money.
        price: {
          $cond: [
            catalogPriceMatch().$expr,
            {
              $convert: {
                input: "$price",
                to: "double",
                onError: null,
                onNull: null,
              },
            },
            null,
          ],
        },
      },
    },
  ]);
};
