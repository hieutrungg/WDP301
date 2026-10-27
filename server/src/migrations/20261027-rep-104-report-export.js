import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { Permission } from "../modules/role-permission/permission.model.js";
import { Role } from "../modules/role-permission/role.model.js";

export const applyRep104Migration = async () => {
  const manager = await Role.findOne({ name: "MANAGER" }).select("_id").lean();
  if (!manager) throw new Error("MANAGER role not found; report permission grants were not changed");
  const permissions = await Permission.find({ name: { $in: ["report.view", "report.export"] } }).select("_id name").lean();
  if (permissions.length !== 2) throw new Error("report.view and report.export must exist before migration");
  const granted = await Role.updateOne(
    { _id: manager._id },
    { $addToSet: { permissionIds: { $each: permissions.map(({ _id }) => _id) } } },
  );
  await mongoose.connection.collection("report_exports").createIndex(
    { branchId: 1, createdAt: -1 }, { name: "idx_report_exports_branch_created_at" },
  );
  await mongoose.connection.collection("report_exports").createIndex(
    { actorId: 1, createdAt: -1 }, { name: "idx_report_exports_actor_created_at" },
  );
  return { permissionsModified: granted.modifiedCount === 1 };
};

const run = async () => {
  await connectDatabase();
  try {
    const result = await applyRep104Migration();
    console.log(result.permissionsModified ? "Granted report.view and report.export to MANAGER" : "Manager already has report permissions");
    console.log("Created report export audit indexes");
  } finally { await mongoose.disconnect(); }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) run().catch((error) => {
  console.error("REP-104 migration failed:", error.message);
  process.exitCode = 1;
});
