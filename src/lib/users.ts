import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import type { UserRole } from "@/types/auth";

const USERS_TABLE = "auth_users";

async function ensureUsersTable() {
  await getDb().query(
    `
    CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','manager','analyst','viewer') NOT NULL DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  );
}

export type AuthUser = {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
};

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureUsersTable();
  const [rows] = await getDb().query<RowDataPacket[]>(
    `SELECT id, email, password_hash, role, created_at FROM ${USERS_TABLE} WHERE email = ? LIMIT 1`,
    [email.toLowerCase()],
  );
  const row = rows[0];
  return row
    ? {
        id: Number(row.id),
        email: String(row.email),
        password_hash: String(row.password_hash),
        role: row.role as UserRole,
        created_at: String(row.created_at),
      }
    : null;
}

export async function listUsers(): Promise<Array<Omit<AuthUser, "password_hash">>> {
  await ensureUsersTable();
  const [rows] = await getDb().query<RowDataPacket[]>(
    `SELECT id, email, role, created_at FROM ${USERS_TABLE} ORDER BY created_at DESC`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    email: String(row.email),
    role: row.role as UserRole,
    created_at: String(row.created_at),
  }));
}

export async function createUser(
  email: string,
  passwordHash: string,
  role: UserRole,
): Promise<Omit<AuthUser, "password_hash">> {
  await ensureUsersTable();
  const [result] = await getDb().query(
    `INSERT INTO ${USERS_TABLE} (email, password_hash, role) VALUES (?, ?, ?)`,
    [email.toLowerCase(), passwordHash, role],
  );
  const insertId = Number((result as { insertId?: number }).insertId || 0);

  return {
    id: insertId,
    email: email.toLowerCase(),
    role,
    created_at: new Date().toISOString(),
  };
}
