import mongoose from "mongoose";
import { AUDIT_ACTIONS, AUDIT_TARGETS } from "./audit.constants.js";

// Immutable business evidence: who did what to which record, and when. `changes` holds a small
// before/after summary of the changed fields only; secrets (password hashes, OTPs) never go in.
const auditLogSchema = new mongoose.Schema(
  {
    actorAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetType: { type: String, enum: AUDIT_TARGETS, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    summary: { type: String, trim: true, maxlength: 300 },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  {
    collection: "audit_logs",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    // No read use case yet, so no secondary index (PROJECT_CONVENTIONS §8).
    autoIndex: false,
  },
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
