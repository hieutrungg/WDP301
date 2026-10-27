import mongoose from "mongoose";
import { PAYMENT_STATUS } from "../payment/payment.constants.js";
import { REFUND_STATUS } from "../refund/refund.constants.js";

const view = (name, collection) => mongoose.models[name] || mongoose.model(
  name,
  new mongoose.Schema({}, { collection, strict: false, versionKey: false }),
);
const PaymentView = view("RevenueExportPaymentView", "payments");
const RefundView = view("RevenueExportRefundView", "refund_requests");

const branchLookups = [
  { $lookup: { from: "bookings", localField: "bookingId", foreignField: "_id", as: "booking" } },
  { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: "showtimes", localField: "booking.showtimeId", foreignField: "_id", as: "showtime" } },
  { $unwind: { path: "$showtime", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: "rooms", localField: "showtime.roomId", foreignField: "_id", as: "room" } },
  { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: "movies", localField: "showtime.movieId", foreignField: "_id", as: "movie" } },
  { $unwind: { path: "$movie", preserveNullAndEmptyArrays: true } },
];

const paymentPipeline = ({ branchId, fromAt, toAt, movieId, category }) => [
  { $match: { status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED] }, paidAt: { $gte: fromAt, $lt: toAt } } },
  ...branchLookups,
  { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order" } },
  { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
  { $match: { $or: [{ "room.branchId": branchId }, { "order.branchId": branchId }] } },
  ...(movieId ? [{ $match: { "showtime.movieId": movieId } }] : []),
  { $project: {
    _id: 1,
    type: { $literal: "PAYMENT" },
    transactionAt: "$paidAt",
    reference: { $ifNull: ["$payableReference", { $toString: "$_id" }] },
    movieTitle: { $ifNull: ["$movie.title", null] },
    method: 1,
    amount: 1,
    ticketAmount: { $ifNull: ["$booking.subtotal", 0] },
    concessionAmount: { $ifNull: ["$booking.concessionAmount", { $ifNull: ["$order.totalAmount", 0] }] },
    reportAmount: category === "TICKETS" ? { $ifNull: ["$booking.subtotal", 0] }
      : category === "CONCESSIONS" ? { $ifNull: ["$booking.concessionAmount", { $ifNull: ["$order.totalAmount", 0] }] }
        : "$amount",
    ticketCount: category === "CONCESSIONS" ? { $literal: 0 } : { $size: { $ifNull: ["$booking.seatIds", []] } },
    concessionSaleCount: category === "TICKETS" ? { $literal: 0 }
      : { $cond: [{ $gt: [{ $ifNull: ["$booking.concessionAmount", { $ifNull: ["$order.totalAmount", 0] }] }, 0] }, 1, 0] },
  } },
  ...(category === "TICKETS" ? [{ $match: { ticketAmount: { $gt: 0 } } }] : []),
  ...(category === "CONCESSIONS" ? [{ $match: { concessionAmount: { $gt: 0 } } }] : []),
];

const refundPipeline = ({ branchId, fromAt, toAt, movieId, category }) => [
  { $match: { status: REFUND_STATUS.REFUNDED, processedAt: { $gte: fromAt, $lt: toAt } } },
  ...branchLookups,
  { $match: { "room.branchId": branchId } },
  ...(movieId ? [{ $match: { "showtime.movieId": movieId } }] : []),
  { $project: {
    _id: 1,
    type: { $literal: "REFUND" },
    transactionAt: "$processedAt",
    reference: { $ifNull: ["$idempotencyKey", { $toString: "$_id" }] },
    movieTitle: { $ifNull: ["$movie.title", null] },
    method: "$paymentMethod",
    amount: "$refundAmount",
    ticketAmount: { $ifNull: ["$ticketAmount", 0] },
    concessionAmount: { $ifNull: ["$concessionAmount", 0] },
    reportAmount: category === "TICKETS" ? { $ifNull: ["$ticketAmount", 0] }
      : category === "CONCESSIONS" ? { $ifNull: ["$concessionAmount", 0] }
        : "$refundAmount",
    ticketCount: { $literal: 0 },
    concessionSaleCount: { $literal: 0 },
  } },
  ...(category === "TICKETS" ? [{ $match: { ticketAmount: { $gt: 0 } } }] : []),
  ...(category === "CONCESSIONS" ? [{ $match: { concessionAmount: { $gt: 0 } } }] : []),
];

const reportFacet = (candidateLimit) => ({
  items: [{ $sort: { transactionAt: -1, _id: -1 } }, { $limit: candidateLimit }],
  totals: [{ $group: {
    _id: null,
    grossAmount: { $sum: { $cond: [{ $eq: ["$type", "PAYMENT"] }, { $ifNull: ["$amount", 0] }, 0] } },
    ticketGrossAmount: { $sum: { $cond: [{ $eq: ["$type", "PAYMENT"] }, { $ifNull: ["$ticketAmount", 0] }, 0] } },
    concessionGrossAmount: { $sum: { $cond: [{ $eq: ["$type", "PAYMENT"] }, { $ifNull: ["$concessionAmount", 0] }, 0] } },
    refundedAmount: { $sum: { $cond: [{ $eq: ["$type", "REFUND"] }, { $ifNull: ["$amount", 0] }, 0] } },
    ticketRefundAmount: { $sum: { $cond: [{ $eq: ["$type", "REFUND"] }, { $ifNull: ["$ticketAmount", 0] }, 0] } },
    concessionRefundAmount: { $sum: { $cond: [{ $eq: ["$type", "REFUND"] }, { $ifNull: ["$concessionAmount", 0] }, 0] } },
    soldTicketCount: { $sum: { $cond: [{ $eq: ["$type", "PAYMENT"] }, { $ifNull: ["$ticketCount", 0] }, 0] } },
    completedConcessionSales: { $sum: { $cond: [{ $eq: ["$type", "PAYMENT"] }, { $ifNull: ["$concessionSaleCount", 0] }, 0] } },
    paymentCount: { $sum: { $cond: [{ $eq: ["$type", "PAYMENT"] }, 1, 0] } },
    refundCount: { $sum: { $cond: [{ $eq: ["$type", "REFUND"] }, 1, 0] } },
  } }],
  count: [{ $count: "total" }],
  series: [{ $group: {
    _id: { $dateToString: { date: "$transactionAt", format: "%Y-%m-%d", timezone: "Asia/Ho_Chi_Minh" } },
    grossAmount: { $sum: { $cond: [{ $eq: ["$type", "PAYMENT"] }, { $ifNull: ["$reportAmount", 0] }, 0] } },
    refundedAmount: { $sum: { $cond: [{ $eq: ["$type", "REFUND"] }, { $ifNull: ["$reportAmount", 0] }, 0] } },
  } }, { $sort: { _id: 1 } }],
});

export const revenueExportRepository = {
  async findBranch(branchId, session) {
    return mongoose.connection.collection("branches").findOne(
      { _id: new mongoose.Types.ObjectId(branchId) },
      { projection: { branchName: 1, status: 1 }, ...(session ? { session } : {}) },
    );
  },

  async listMovies() {
    return mongoose.connection.collection("movies").find(
      {}, { projection: { title: 1, status: 1 } },
    ).sort({ title: 1 }).toArray();
  },

  async getReport({ branchId, fromAt, toAt, movieId, category, page, limit, session }) {
    const filters = { branchId, fromAt, toAt, movieId, category };
    const candidateLimit = (page - 1) * limit + limit;
    const [paymentResult] = await PaymentView.aggregate([
      ...paymentPipeline(filters), { $facet: reportFacet(candidateLimit) },
    ]).session(session).exec();
    const [refundResult] = await RefundView.aggregate([
      ...refundPipeline(filters), { $facet: reportFacet(candidateLimit) },
    ]).session(session).exec();
    const payments = paymentResult ?? {};
    const refunds = refundResult ?? {};
    const totals = {};
    for (const key of ["grossAmount", "ticketGrossAmount", "concessionGrossAmount", "refundedAmount", "ticketRefundAmount", "concessionRefundAmount", "soldTicketCount", "completedConcessionSales", "paymentCount", "refundCount"]) {
      totals[key] = (payments.totals?.[0]?.[key] ?? 0) + (refunds.totals?.[0]?.[key] ?? 0);
    }
    const items = [...(payments.items ?? []), ...(refunds.items ?? [])]
      .sort((left, right) => right.transactionAt - left.transactionAt || String(right._id).localeCompare(String(left._id)))
      .slice((page - 1) * limit, page * limit);
    const seriesByDate = new Map();
    for (const row of [...(payments.series ?? []), ...(refunds.series ?? [])]) {
      const current = seriesByDate.get(row._id) ?? { date: row._id, grossAmount: 0, refundedAmount: 0 };
      current.grossAmount += row.grossAmount ?? 0;
      current.refundedAmount += row.refundedAmount ?? 0;
      seriesByDate.set(row._id, current);
    }
    return {
      items,
      totals,
      total: (payments.count?.[0]?.total ?? 0) + (refunds.count?.[0]?.total ?? 0),
      series: [...seriesByDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
    };
  },

  async recordExport(entry, session) {
    await mongoose.connection.collection("report_exports").insertOne(entry, { session });
  },
};
