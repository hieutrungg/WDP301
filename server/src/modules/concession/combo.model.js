import mongoose from "mongoose";

// Read model of the existing documented `combos` collection. No DDL or writes on import.
// No isPublic, description-on-Concession, index or separate combo stock is added.
const componentSchema = new mongoose.Schema(
  {
    concessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Concession",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
  },
  { _id: false },
);

const comboSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    imageUrl: { type: String, trim: true },
    price: { type: Number, min: 0, validate: Number.isSafeInteger },
    status: { type: String, required: true, enum: ["ACTIVE", "INACTIVE"] },
    items: {
      type: [componentSchema],
      required: true,
      validate: (items) =>
        items.length > 0 &&
        new Set(items.map((item) => item.concessionId.toString())).size ===
          items.length,
    },
  },
  {
    collection: "combos",
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
  },
);

export const Combo = mongoose.model("Combo", comboSchema);
