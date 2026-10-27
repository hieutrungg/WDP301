import mongoose from "mongoose";

const accountRef = { type: mongoose.Schema.Types.ObjectId, ref: "Account" };

// `name` is the identifier used by requireRole and the client role redirect; system role names
// (role.constants.js) never change. createdBy/updatedBy/timestamps are optional additions for
// ROLE-101..103 (CR-21), so seeded roles without them stay valid.
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
    createdBy: accountRef,
    updatedBy: accountRef,
  },
  { versionKey: false, timestamps: true },
);

export const Role = mongoose.model("Role", roleSchema);
