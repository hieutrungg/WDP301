import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../config/db.js";

await connectDb();
try {
  await mongoose.connection.db.collection("payments").createIndex(
    { status: 1, paidAt: 1, amount: 1 },
    { name: "idx_payment_revenue_paid_at" },
  );
  await mongoose.connection.db.collection("refund_requests").createIndex(
    { status: 1, processedAt: 1, refundAmount: 1 },
    { name: "idx_refund_revenue_processed_at" },
  );
} finally {
  await disconnectDb();
}
