import { connectDb, disconnectDb } from "../config/db.js";
import mongoose from "mongoose";

await connectDb();
const db = mongoose.connection.db;
const refunds = db.collection("refund_requests");
await refunds.createIndex({ bookingId: 1 }, { unique: true, name: "uniq_refund_booking" });
await refunds.createIndex({ idempotencyKey: 1 }, { unique: true, name: "uniq_refund_idempotency", partialFilterExpression: { idempotencyKey: { $type: "string" } } });
await refunds.createIndex({ status: 1, requestedAt: 1 }, { name: "idx_refund_manager_queue" });
await refunds.createIndex({ customerAccountId: 1, requestedAt: -1 }, { name: "idx_refund_customer_history" });
await disconnectDb();
