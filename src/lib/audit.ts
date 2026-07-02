import { getDb, tableExists } from "@/lib/db";
import type { CurrentUser } from "@/types/auth";

type AuditInput = {
  user: CurrentUser;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    if (!(await tableExists("audit_logs"))) return;

    await getDb().execute(
      `
      INSERT INTO audit_logs
        (user_email, action, entity_type, entity_id, ip_address, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        input.user.email,
        input.action,
        input.entityType,
        input.entityId ? String(input.entityId) : null,
        input.ipAddress || null,
        JSON.stringify(input.metadata || {}),
      ],
    );
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
