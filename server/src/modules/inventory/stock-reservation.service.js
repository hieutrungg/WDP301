import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { Inventory } from "./inventory.model.js";
import { StockTransaction } from "./stock-transaction.model.js";
import { StockReservation } from "./stock-reservation.model.js";

const failure = () =>
  new AppError(
    409,
    "Some selected food is no longer available. Edit your selection or continue without food.",
    [],
    "INSUFFICIENT_CONCESSION_STOCK",
  );
const requireSession = (session) => {
  if (!session?.inTransaction())
    throw new TypeError("Stock reservation requires the checkout transaction");
};
const releaseRecord = async (record, session) => {
  const changed = await StockReservation.updateOne(
    { _id: record._id, status: "ACTIVE" },
    { $set: { status: "RELEASED" } },
    { session },
  );
  if (!changed.modifiedCount) return;
  for (const item of record.items) {
    const result = await Inventory.updateOne(
      {
        branchId: record.branchId,
        concessionId: item.concessionId,
        reservedQuantity: { $gte: item.quantity },
      },
      { $inc: { reservedQuantity: -item.quantity } },
      { session },
    );
    if (result.modifiedCount !== 1) throw failure();
  }
};
// Expiry reconciliation uses bounded, independently committed batches, before checkout's transaction.
export const releaseExpiredStock = async ({ branchId, now }) => {
  while (true) {
    const released = await mongoose.connection.transaction(async (session) => {
      const records = await StockReservation.find({
        branchId,
        status: "ACTIVE",
        expiresAt: { $lte: now },
      })
        .sort({ expiresAt: 1 })
        .limit(100)
        .session(session)
        .lean();
      for (const record of records) await releaseRecord(record, session);
      return records.length;
    });
    if (released < 100) return;
  }
};
export const reserveStock = async ({
  bookingId,
  orderId,
  ownerId,
  branchId,
  items,
  expiresAt,
  now,
  session,
}) => {
  requireSession(session);
  if (expiresAt <= now || !items.length || items.length > 500) throw failure();
  const expired = await StockReservation.find({
    branchId,
    status: "ACTIVE",
    expiresAt: { $lte: now },
  })
    .limit(101)
    .session(session)
    .lean();
  if (expired.length > 100) throw failure();
  for (const record of expired) await releaseRecord(record, session);
  // Sorted writes reduce contention when multiple combos share the same components.
  for (const item of [...items].sort((a, b) =>
    String(a.concessionId).localeCompare(String(b.concessionId)),
  )) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1)
      throw failure();
    const result = await Inventory.updateOne(
      {
        branchId,
        concessionId: item.concessionId,
        $expr: {
          $gte: [
            { $subtract: ["$quantity", { $ifNull: ["$reservedQuantity", 0] }] },
            item.quantity,
          ],
        },
      },
      { $inc: { reservedQuantity: item.quantity } },
      { session },
    );
    if (result.modifiedCount !== 1) throw failure();
  }
  await StockReservation.create(
    [
      {
        bookingId,
        orderId,
        ownerId,
        branchId,
        items,
        expiresAt,
        status: "ACTIVE",
      },
    ],
    { session },
  );
};
export const consumeStock = async ({ orderId, now, session }) => {
  requireSession(session);
  const record = await StockReservation.findOne({ orderId })
    .session(session)
    .lean();
  if (record?.status === "CONSUMED") return true;
  if (!record || record.status !== "ACTIVE" || record.expiresAt <= now)
    return false;
  const changed = await StockReservation.updateOne(
    { _id: record._id, status: "ACTIVE" },
    { $set: { status: "CONSUMED" } },
    { session },
  );
  if (changed.modifiedCount !== 1) throw failure();
  for (const item of record.items) {
    const result = await Inventory.updateOne(
      {
        branchId: record.branchId,
        concessionId: item.concessionId,
        quantity: { $gte: item.quantity },
        reservedQuantity: { $gte: item.quantity },
      },
      { $inc: { quantity: -item.quantity, reservedQuantity: -item.quantity } },
      { session },
    );
    if (result.modifiedCount !== 1) throw failure();
    await StockTransaction.create(
      [
        {
          branchId: record.branchId,
          concessionId: item.concessionId,
          type: "SALE",
          quantity: item.quantity,
          recordedBy: record.ownerId,
          source: "ONLINE_CHECKOUT",
          orderId: record.orderId,
          bookingId: record.bookingId,
          transactionDate: now,
        },
      ],
      { session },
    );
  }
  return true;
};
export const releaseStock = async ({ orderId, session }) => {
  requireSession(session);
  const record = await StockReservation.findOne({ orderId })
    .session(session)
    .lean();
  if (record?.status === "CONSUMED") throw failure();
  if (record?.status === "ACTIVE") await releaseRecord(record, session);
};
// Advisory reads ignore logically expired reservations; checkout reconciles their counters.
export const readLiveReserved = async ({
  branchId,
  concessionIds,
  now = new Date(),
  session,
}) => {
  const rows = await StockReservation.aggregate([
    {
      $match: {
        branchId: new mongoose.Types.ObjectId(branchId),
        status: "ACTIVE",
        expiresAt: { $gt: now },
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.concessionId": {
          $in: concessionIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    },
    {
      $group: {
        _id: "$items.concessionId",
        quantity: { $sum: "$items.quantity" },
      },
    },
  ]).session(session ?? null);
  return new Map(rows.map((row) => [String(row._id), row.quantity]));
};
