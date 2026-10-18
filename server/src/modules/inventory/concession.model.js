import mongoose from "mongoose";
import { CONCESSION_STATUS, CONCESSION_STATUSES, DEFAULT_UNIT } from "./inventory.constants.js";

// Catalog item. `unit` was added for UC39 (the list shows a unit per item); `size` stays a
// variant label such as "Large".
const concessionSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ConcessionCategory", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    size: { type: String, trim: true, maxlength: 60 },
    unit: { type: String, trim: true, maxlength: 40, default: DEFAULT_UNIT },
    price: { type: Number, min: 0, validate: Number.isInteger },
    imageUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: CONCESSION_STATUSES,
      required: true,
      default: CONCESSION_STATUS.ACTIVE,
    },
  },
  { collection: "concessions", versionKey: false },
);

export const Concession = mongoose.model("Concession", concessionSchema);
