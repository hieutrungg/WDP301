import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  passwordHash: {
    type: String,
    required: true,
    select: false,
  },

  phone: String,

  roleIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
  ],

  directPermissionIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
    },
  ],

  status: String,

  profile: {
    fullName: String,
    dateOfBirth: Date,
    address: String,
  },

  employeeProfile: {
    branchId: mongoose.Schema.Types.ObjectId,
    position: String,
  },
}, {
  timestamps: true,
});

export const Account = mongoose.model("Account", accountSchema);
