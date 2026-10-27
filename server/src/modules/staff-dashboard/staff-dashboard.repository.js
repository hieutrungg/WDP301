import mongoose from "mongoose";

export const readStaffCounterActivity = async ({ staffId, from, to }) => {
  const staffObjectId = new mongoose.Types.ObjectId(staffId);
  const db = mongoose.connection.db;
  const [bookings, orders] = await Promise.all([
    db
      .collection("bookings")
      .find({
        createdByStaffId: staffObjectId,
        channel: "COUNTER",
        status: "CONFIRMED",
        confirmedAt: { $gte: from, $lt: to },
      })
      .project({
        bookingCode: 1,
        totalAmount: 1,
        seatIds: 1,
        confirmedAt: 1,
        paymentId: 1,
      })
      .sort({ confirmedAt: -1 })
      .toArray(),
    db
      .collection("orders")
      .find({
        createdByStaffId: staffObjectId,
        type: "COUNTER",
        status: "CONFIRMED",
        paidAt: { $gte: from, $lt: to },
      })
      .project({
        orderCode: 1,
        totalAmount: 1,
        items: 1,
        paidAt: 1,
        paymentId: 1,
      })
      .sort({ paidAt: -1 })
      .toArray(),
  ]);
  return { bookings, orders };
};
