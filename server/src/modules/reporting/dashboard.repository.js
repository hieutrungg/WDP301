import mongoose from "mongoose";
import { PAYMENT_STATUS } from "../payment/payment.constants.js";
import { REFUND_STATUS } from "../refund/refund.constants.js";
import { TICKET_STATUS } from "../ticket/ticket.constants.js";

// Read-only projections let the reporting module run bounded cross-collection analytics without
// taking ownership of another domain's documents or importing its persistence implementation.
const view = (name, collection) => mongoose.models[name] || mongoose.model(
  name,
  new mongoose.Schema({}, { collection, strict: false, versionKey: false }),
);
const PaymentView = view("ReportingPaymentView", "payments");
const RefundView = view("ReportingRefundView", "refund_requests");
const ShowtimeView = view("ReportingShowtimeView", "showtimes");
view("ReportingRoomView", "rooms");
const TicketView = view("ReportingTicketView", "tickets");

const branchScopeStages = (branchId) => [
  { $lookup: { from: "bookings", localField: "bookingId", foreignField: "_id", as: "booking" } },
  { $unwind: "$booking" },
  { $lookup: { from: "showtimes", localField: "booking.showtimeId", foreignField: "_id", as: "showtime" } },
  { $unwind: "$showtime" },
  { $lookup: { from: "rooms", localField: "showtime.roomId", foreignField: "_id", as: "room" } },
  { $unwind: "$room" },
  { $match: { "room.branchId": branchId } },
];

export const dashboardRepository = {
  async revenueByTransactionDate({ branchId, fromAt, toAt, session }) {
    const payments = await PaymentView.aggregate([
        { $match: { status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED] }, paidAt: { $gte: fromAt, $lt: toAt } } },
        ...branchScopeStages(branchId),
        { $group: { _id: { $dateToString: { date: "$paidAt", format: "%Y-%m-%d", timezone: "Asia/Ho_Chi_Minh" } }, amount: { $sum: "$amount" } } },
      ]).session(session).exec();
    const refunds = await RefundView.aggregate([
        { $match: { status: REFUND_STATUS.REFUNDED, processedAt: { $gte: fromAt, $lt: toAt } } },
        ...branchScopeStages(branchId),
        { $group: { _id: { $dateToString: { date: "$processedAt", format: "%Y-%m-%d", timezone: "Asia/Ho_Chi_Minh" } }, amount: { $sum: "$refundAmount" } } },
      ]).session(session).exec();
    return { payments, refunds };
  },

  async completedShowtimeOccupancy({ branchId, fromAt, toAt, session }) {
    return ShowtimeView.aggregate([
      { $match: { status: "PUBLISHED", startAt: { $gte: fromAt, $lt: toAt }, endAt: { $lte: toAt } } },
      { $lookup: { from: "rooms", localField: "roomId", foreignField: "_id", as: "room" } },
      { $unwind: "$room" },
      { $match: { "room.branchId": branchId } },
      { $lookup: {
        from: "showtime_seats", let: { showtimeId: "$_id" }, as: "seatRows",
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$showtimeId", "$$showtimeId"] }, { $ne: ["$state", "UNAVAILABLE"] }] } } }, { $count: "capacity" }],
      } },
      { $lookup: {
        from: "tickets", let: { showtimeId: "$_id" }, as: "ticketRows",
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$showtimeId", "$$showtimeId"] }, { $in: ["$status", [TICKET_STATUS.ISSUED, TICKET_STATUS.USED]] }] } } },
          { $lookup: { from: "bookings", localField: "bookingId", foreignField: "_id", as: "booking" } },
          { $unwind: "$booking" }, { $match: { "booking.status": { $ne: "REFUNDED" } } }, { $count: "tickets" },
        ],
      } },
      { $project: { capacity: { $ifNull: [{ $arrayElemAt: ["$seatRows.capacity", 0] }, 0] }, tickets: { $ifNull: [{ $arrayElemAt: ["$ticketRows.tickets", 0] }, 0] } } },
      { $group: { _id: null, availableSeatCapacity: { $sum: "$capacity" }, validTickets: { $sum: "$tickets" }, completedShowtimes: { $sum: 1 } } },
    ]).session(session).exec();
  },

  async trendingShowtimes({ branchId, fromAt, toAt, session }) {
    return TicketView.aggregate([
      { $match: { status: { $in: [TICKET_STATUS.ISSUED, TICKET_STATUS.USED] }, issuedAt: { $gte: fromAt, $lt: toAt } } },
      { $lookup: { from: "bookings", localField: "bookingId", foreignField: "_id", as: "booking" } },
      { $unwind: "$booking" }, { $match: { "booking.status": { $ne: "REFUNDED" } } },
      { $group: { _id: "$showtimeId", ticketsSold: { $sum: 1 } } },
      { $lookup: { from: "showtimes", localField: "_id", foreignField: "_id", as: "showtime" } },
      { $unwind: "$showtime" },
      { $lookup: { from: "rooms", localField: "showtime.roomId", foreignField: "_id", as: "room" } },
      { $unwind: "$room" }, { $match: { "room.branchId": branchId } },
      { $facet: {
        items: [
          { $sort: { ticketsSold: -1, "showtime.startAt": 1, _id: 1 } }, { $limit: 5 },
          { $lookup: { from: "movies", localField: "showtime.movieId", foreignField: "_id", as: "movie" } },
          { $unwind: { path: "$movie", preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, showtimeId: { $toString: "$_id" }, movieTitle: { $ifNull: ["$movie.title", "Unknown movie"] }, startAt: "$showtime.startAt", ticketsSold: 1 } },
        ],
        totals: [{ $group: { _id: null, ticketsSold: { $sum: "$ticketsSold" } } }],
      } },
    ]).session(session).exec().then(([result]) => ({
      items: result?.items ?? [],
      ticketsSold: result?.totals?.[0]?.ticketsSold ?? 0,
    }));
  },
};
