import { getDb } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

let authTablesReady: Promise<void> | null = null;

async function createAuthTables() {
  const db = getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','manager','analyst','viewer') NOT NULL DEFAULT 'viewer',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_login_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_app_users_role (role),
      INDEX idx_app_users_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      session_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      ip_address VARCHAR(100) NULL,
      user_agent TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
      INDEX idx_app_sessions_user (user_id),
      INDEX idx_app_sessions_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_login_attempts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NULL,
      success TINYINT(1) NOT NULL DEFAULT 0,
      ip_address VARCHAR(100) NULL,
      user_agent TEXT NULL,
      error_message TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_login_attempts_email (email),
      INDEX idx_login_attempts_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_email VARCHAR(255),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100),
      entity_id BIGINT UNSIGNED NULL,
      ip_address VARCHAR(100),
      metadata_json LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [legacyRows] = await db.query<Array<RowDataPacket & { total: number }>>(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'auth_users'
    `,
  );

  if (Number(legacyRows[0]?.total || 0) > 0) {
    await db.query(`
      INSERT INTO app_users
        (email, full_name, password_hash, role, is_active, created_at, updated_at)
      SELECT
        LOWER(email),
        COALESCE(NULLIF(REPLACE(SUBSTRING_INDEX(email, '@', 1), '.', ' '), ''), email),
        password_hash,
        role,
        1,
        created_at,
        NOW()
      FROM auth_users
      ON DUPLICATE KEY UPDATE
        password_hash = app_users.password_hash,
        role = app_users.role,
        updated_at = app_users.updated_at
    `);
  }
}

export async function ensureAuthTables() {
  authTablesReady ??= createAuthTables();
  return authTablesReady;
}
