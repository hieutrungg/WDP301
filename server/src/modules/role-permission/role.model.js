import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    permissionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
  },
  { versionKey: false },
);

export const Role = mongoose.model("Role", roleSchema);
