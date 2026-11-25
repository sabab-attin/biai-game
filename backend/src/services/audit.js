import { AdminAudit } from '../models/AdminAudit.js';

export async function logAdminAction(adminId, action, details = {}, logger = console) {
  try {
    await AdminAudit.create({ adminId, action, details });
  } catch (error) {
    logger.error(`[admin-audit] Could not log "${action}":`, error);
  }
}

export function serializeAuditEntry(entry) {
  return {
    id: String(entry._id),
    adminId: String(entry.adminId),
    action: entry.action,
    details: entry.details || {},
    timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
  };
}
