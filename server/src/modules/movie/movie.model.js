import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    roleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],

    status: {
      type: String,
      enum: ["ACTIVE", "DISABLED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  },
);

export const Account = mongoose.model("Account", accountSchema);