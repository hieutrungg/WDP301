import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
  },
  { versionKey: false },
);

export const Permission = mongoose.model("Permission", permissionSchema);
