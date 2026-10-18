import mongoose from "mongoose";
import { Concession } from "./concession.model.js";
import { ConcessionCategory } from "./concession-category.model.js";
import {
  CONCESSION_STATUS,
  DEFAULT_MIN_THRESHOLD,
  STOCK_STATUS,
  STOCK_TRANSACTION_TYPE,
} from "./inventory.constants.js";
import { Inventory } from "./inventory.model.js";
import { StockTransaction } from "./stock-transaction.model.js";
import { Supplier } from "./supplier.model.js";

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

// Sort rank: out-of-stock first, then low stock, then healthy items.
const STATUS_RANK = {
  [STOCK_STATUS.OUT_OF_STOCK]: 0,
  [STOCK_STATUS.LOW_STOCK]: 1,
  [STOCK_STATUS.IN_STOCK]: 2,
};

// Starts at the catalog, not at `inventories`: an item that was never stocked has no inventory row
// and must still show up with quantity 0 (out of stock). Status is derived here, in one place, so
// the list, the filter and the summary can never disagree.
const stockLevelPipeline = (branchId) => [
  { $match: { status: CONCESSION_STATUS.ACTIVE } },
  {
    $lookup: {
      from: Inventory.collection.name,
      let: { concessionId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$concessionId", "$$concessionId"] },
                { $eq: ["$branchId", toObjectId(branchId)] },
              ],
            },
          },
        },
        { $limit: 1 },
      ],
      as: "inventory",
    },
  },
  { $set: { inventory: { $first: "$inventory" } } },
  {
    $set: {
      quantity: { $ifNull: ["$inventory.quantity", 0] },
      minThreshold: { $ifNull: ["$inventory.minThreshold", DEFAULT_MIN_THRESHOLD] },
      inventoryUpdatedAt: { $ifNull: ["$inventory.updatedAt", null] },
    },
  },
  {
    $set: {
      stockStatus: {
        $switch: {
          branches: [
            { case: { $lte: ["$quantity", 0] }, then: STOCK_STATUS.OUT_OF_STOCK },
            { case: { $lte: ["$quantity", "$minThreshold"] }, then: STOCK_STATUS.LOW_STOCK },
          ],
          default: STOCK_STATUS.IN_STOCK,
        },
      },
    },
  },
  {
    $set: {
      statusRank: {
        $switch: {
          branches: Object.entries(STATUS_RANK).map(([status, rank]) => ({
            case: { $eq: ["$stockStatus", status] },
            then: rank,
          })),
          default: 2,
        },
      },
    },
  },
];

export const findStockLevels = async (branchId, { match, skip, limit }) => {
  const [result] = await Concession.aggregate([
    ...stockLevelPipeline(branchId),
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    {
      $facet: {
        items: [
          { $sort: { statusRank: 1, quantity: 1, name: 1, _id: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: ConcessionCategory.collection.name,
              localField: "categoryId",
              foreignField: "_id",
              as: "category",
            },
          },
          { $set: { category: { $first: "$category" } } },
          { $project: { inventory: 0 } },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  return { items: result.items, total: result.total[0]?.count ?? 0 };
};

export const countStockLevelsByStatus = async (branchId) => {
  const rows = await Concession.aggregate([
    ...stockLevelPipeline(branchId),
    { $group: { _id: "$stockStatus", count: { $sum: 1 } } },
  ]);

  return Object.fromEntries(rows.map(({ _id, count }) => [_id, count]));
};

export const listCategories = () =>
  ConcessionCategory.find({}, { name: 1 }).sort({ name: 1, _id: 1 }).lean().exec();

export const listSuppliers = () =>
  Supplier.find({}, { name: 1, phone: 1 }).sort({ name: 1, _id: 1 }).lean().exec();

export const findSupplierById = (supplierId) =>
  Supplier.findById(supplierId, { name: 1 }).lean().exec();

export const findConcessionsByIds = (concessionIds) =>
  Concession.find({ _id: { $in: concessionIds } }, { name: 1, unit: 1, status: 1 }).lean().exec();

// Applies every line of one receipt or none of them (UC40 alternative sequence at step 9: a failed
// update keeps the previous quantity). `$inc` with upsert is atomic per row, so concurrent
// stock-ins and sales never overwrite each other; the transaction ties the quantity changes to
// their audit rows.
export const receiveStock = async ({
  branchId,
  recordedBy,
  supplierId,
  receiptCode,
  receivedAt,
  note,
  lines,
}) => {
  const session = await mongoose.connection.startSession();
  let levels;

  try {
    await session.withTransaction(async () => {
      levels = [];

      // A stable order keeps two overlapping receipts from locking rows in opposite orders.
      const ordered = [...lines].sort((a, b) => a.concessionId.localeCompare(b.concessionId));

      for (const { concessionId, quantity } of ordered) {
        const inventory = await Inventory.findOneAndUpdate(
          { branchId, concessionId },
          { $inc: { quantity } },
          { upsert: true, returnDocument: "after", session, setDefaultsOnInsert: true },
        ).lean();

        levels.push({ concessionId, quantityAdded: quantity, quantityAfter: inventory.quantity });
      }

      await StockTransaction.insertMany(
        ordered.map(({ concessionId, quantity }) => ({
          branchId,
          concessionId,
          ...(supplierId ? { supplierId } : {}),
          type: STOCK_TRANSACTION_TYPE.IMPORT,
          quantity,
          recordedBy,
          transactionDate: receivedAt,
          ...(note ? { note } : {}),
          receiptCode,
        })),
        { session, ordered: true },
      );
    });

    return levels;
  } finally {
    await session.endSession();
  }
};

export const findStockInHistory = async (branchId, { skip, limit }) => {
  const match = { branchId: toObjectId(branchId), type: STOCK_TRANSACTION_TYPE.IMPORT };

  const [items, total] = await Promise.all([
    StockTransaction.aggregate([
      { $match: match },
      { $sort: { transactionDate: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: Concession.collection.name,
          localField: "concessionId",
          foreignField: "_id",
          as: "concession",
        },
      },
      {
        $lookup: {
          from: Supplier.collection.name,
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier",
        },
      },
      // Accounts belong to another module; only the display name is read.
      {
        $lookup: {
          from: "accounts",
          localField: "recordedBy",
          foreignField: "_id",
          pipeline: [{ $project: { username: 1, "profile.fullName": 1 } }],
          as: "recorder",
        },
      },
      {
        $set: {
          concession: { $first: "$concession" },
          supplier: { $first: "$supplier" },
          recorder: { $first: "$recorder" },
        },
      },
    ]),
    StockTransaction.countDocuments(match),
  ]);

  return { items, total };
};
