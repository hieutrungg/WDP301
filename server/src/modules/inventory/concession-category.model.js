import mongoose from "mongoose";

const concessionCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
  },
  { collection: "concession_categories", versionKey: false },
);

export const ConcessionCategory = mongoose.model("ConcessionCategory", concessionCategorySchema);
