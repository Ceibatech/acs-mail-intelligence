import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { ensureAuthTables } from "@/lib/auth-schema";
import type { UserRole } from "@/types/auth";

const roles: UserRole[] = ["admin", "manager", "analyst", "viewer"];

function normalizeRole(value: string): UserRole {
  return roles.includes(value as UserRole) ? (value as UserRole) : "viewer";
}

function defaultFullName(email: string) {
  const localPart = email.split("@")[0] || email;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureAuthTables();

  const [rows] = await getDb().query<RowDataPacket[]>(
    `
    SELECT
      id,
      email,
      full_name,
      password_hash,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at
    FROM app_users
    WHERE email = ?
    LIMIT 1
    `,
    [email.toLowerCase()],
  );

  const row = rows[0];
  return row
    ? {
        id: Number(row.id),
        email: String(row.email),
        full_name: String(row.full_name),
        password_hash: String(row.password_hash),
        role: normalizeRole(String(row.role)),
        is_active: Number(row.is_active) === 1,
        last_login_at: row.last_login_at ? String(row.last_login_at) : null,
        created_at: String(row.created_at),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }
    : null;
}

export async function listUsers(): Promise<Array<Omit<AuthUser, "password_hash">>> {
  await ensureAuthTables();

  const [rows] = await getDb().query<RowDataPacket[]>(
    `
    SELECT id, email, full_name, role, is_active, last_login_at, created_at, updated_at
    FROM app_users
    ORDER BY created_at DESC
    `,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    email: String(row.email),
    full_name: String(row.full_name),
    role: normalizeRole(String(row.role)),
    is_active: Number(row.is_active) === 1,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function createUser(
  email: string,
  passwordHash: string,
  role: UserRole,
  fullName?: string,
): Promise<Omit<AuthUser, "password_hash">> {
  await ensureAuthTables();

  const normalizedEmail = email.toLowerCase();
  const resolvedFullName = fullName?.trim() || defaultFullName(normalizedEmail);
  const normalizedRole = normalizeRole(role);

  const [result] = await getDb().query(
    `
    INSERT INTO app_users
      (email, full_name, password_hash, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, NOW())
    `,
    [normalizedEmail, resolvedFullName, passwordHash, normalizedRole],
  );
  const insertId = Number((result as { insertId?: number }).insertId || 0);

  return {
    id: insertId,
    email: normalizedEmail,
    full_name: resolvedFullName,
    role: normalizedRole,
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: null,
  };
}

export async function updateLastLogin(userId: number) {
  await ensureAuthTables();

  await getDb().execute(
    "UPDATE app_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?",
    [userId],
  );
}
