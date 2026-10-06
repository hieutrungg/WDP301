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
});