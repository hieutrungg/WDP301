import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../config/db.js";

await connectDb();
try {
  const refunds = mongoose.connection.db.collection("refund_requests");
  const indexes = await refunds.indexes();
  const legacy = indexes.find((index) => index.name === "uniq_refund_booking");
  if (legacy) await refunds.dropIndex(legacy.name);
  await refunds.updateMany(
    { requestType: { $exists: false } },
    { $set: { requestType: "CUSTOMER_REQUEST" } },
  );
  await refunds.createIndex(
    { bookingId: 1, requestType: 1 },
    { unique: true, name: "uniq_refund_booking_type" },
  );
} finally {
  await disconnectDb();
}
