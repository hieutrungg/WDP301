import mongoose from "mongoose";
import { DEFAULT_MIN_THRESHOLD } from "./inventory.constants.js";

// Current stock of one concession item at one branch. `minThreshold` was added for UC39: an item
// at or below it is LOW_STOCK. It lives here, not on `concessions`, so each branch can restock at
// its own level.
const inventorySchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    concessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Concession", required: true },
    quantity: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    minThreshold: {
      type: Number,
      required: true,
      min: 0,
      default: DEFAULT_MIN_THRESHOLD,
      validate: Number.isInteger,
    },
  },
  {
    collection: "inventories",
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
  },
);

inventorySchema.index({ branchId: 1, concessionId: 1 }, { unique: true, name: "uniq_inventory_branch_concession" });

export const Inventory = mongoose.model("Inventory", inventorySchema);
