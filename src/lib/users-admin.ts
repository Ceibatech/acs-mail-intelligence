import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createUser, getUserByEmail, listUsers } from "@/lib/users";
import { ensureAuthTables } from "@/lib/auth-schema";
import type { UserRole } from "@/types/auth";

export async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME || "Administrateur ACS";

  if (!email || !password) return null;

  await ensureAuthTables();
  const passwordHash = await hashPassword(password);

  await getDb().execute(
    `
    INSERT INTO app_users
      (email, full_name, password_hash, role, is_active, created_at)
    VALUES (?, ?, ?, 'admin', 1, NOW())
    ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      password_hash = VALUES(password_hash),
      role = 'admin',
      is_active = 1,
      updated_at = NOW()
    `,
    [email, fullName, passwordHash],
  );

  return getUserByEmail(email);
}

export async function getUsersForAdmin() {
  return listUsers();
}

export async function createAdminUser(
  email: string,
  password: string,
  role: UserRole,
  fullName?: string,
) {
  const passwordHash = await hashPassword(password);
  return createUser(email, passwordHash, role, fullName);
}
