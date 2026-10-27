import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
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

  // Admin who created / last changed a staff account (STAFF-101, CR-21). Optional: self-registered
  // and seeded accounts have neither.
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
}, {
  timestamps: true,
});

export const Account = mongoose.model("Account", accountSchema);
