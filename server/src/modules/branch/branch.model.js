import mongoose from "mongoose";
import { BRANCH_NAME_COLLATION, BRANCH_STATUS, BRANCH_STATUSES } from "./branch.constants.js";

// A-25 M0 fields only. Operating hours and branch-scoped RBAC are explicitly outside M0.
const branchSchema = new mongoose.Schema(
  {
    branchName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    hotline: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: BRANCH_STATUSES,
      required: true,
      default: BRANCH_STATUS.ACTIVE,
    },
  },
  {
    collection: "branches",
    timestamps: true,
    versionKey: false,
  },
);

branchSchema.index(
  { branchName: 1 },
  { unique: true, collation: BRANCH_NAME_COLLATION, name: "uniq_branch_name_normalized" },
);

export const Branch = mongoose.model("Branch", branchSchema);
