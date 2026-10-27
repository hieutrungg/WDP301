import { AuditLog } from "./audit-log.model.js";

/**
 * Appends one audit record. Called after the audited write has been saved, so a failure here is
 * logged and does not undo or fail the admin action (no multi-document transaction for these
 * low-contention admin writes; see docs/RBAC-ADMIN-IMPLEMENTATION.md).
 */
export const recordAuditEvent = async ({
  actorAccountId,
  action,
  targetType,
  targetId,
  summary,
  changes,
}) => {
  try {
    await AuditLog.create({ actorAccountId, action, targetType, targetId, summary, changes });
  } catch (error) {
    console.error(`[audit] failed to record ${action} for ${targetType} ${targetId}`, error);
  }
};
