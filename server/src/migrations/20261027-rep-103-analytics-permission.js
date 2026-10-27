import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { Permission } from "../modules/role-permission/permission.model.js";
import { Role } from "../modules/role-permission/role.model.js";

export const grantManagerAnalyticsView = async () => {
  const [manager, permission] = await Promise.all([
    Role.findOne({ name: "MANAGER" }).select("_id permissionIds").lean(),
    Permission.findOne({ name: "analytics.view" }).select("_id").lean(),
  ]);
  if (!manager) throw new Error("MANAGER role not found; no role permissions were changed");
  if (!permission) throw new Error("analytics.view permission not found; no role permissions were changed");
  const result = await Role.updateOne(
    { _id: manager._id },
    { $addToSet: { permissionIds: permission._id } },
  );
  return { modified: result.modifiedCount === 1 };
};

const run = async () => {
  await connectDatabase();
  try {
    const result = await grantManagerAnalyticsView();
    console.log(result.modified ? "Granted analytics.view to MANAGER" : "MANAGER already has analytics.view");
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  run().catch((error) => {
    console.error("REP-103 permission migration failed:", error.message);
    process.exitCode = 1;
  });
}
