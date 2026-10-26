import mongoose from "mongoose";
import { STOCK_TRANSACTION_TYPES } from "./inventory.constants.js";

// Immutable audit trail of stock movements. One row per item line; `receiptCode` groups the lines
// of a single UC40 stock-in request (added for UC40).
const stockTransactionSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    concessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Concession", required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    type: { type: String, enum: STOCK_TRANSACTION_TYPES, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    // IMPORT retains its Staff actor. Online SALE records the actual Customer, never a fake Staff.
    source: { type: String, enum: ["ONLINE_CHECKOUT"] },
    orderId: { type: mongoose.Schema.Types.ObjectId },
    bookingId: { type: mongoose.Schema.Types.ObjectId },
    transactionDate: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    receiptCode: { type: String, trim: true },
  },
  { collection: "stock_transactions", versionKey: false },
);

// Serves the stock-in history list: newest receipts of one type at one branch.
stockTransactionSchema.index(
  { branchId: 1, type: 1, transactionDate: -1 },
  { name: "idx_stock_transaction_branch_type_date" },
);

export const StockTransaction = mongoose.model("StockTransaction", stockTransactionSchema);
