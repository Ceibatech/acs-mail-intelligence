import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) process.env[key] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function ensureAuthTables(connection) {
  await connection.query(`
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

  await connection.query(`
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

  await connection.query(`
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
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const adminEmail = requiredEnv("ADMIN_EMAIL").trim().toLowerCase();
const adminPassword = requiredEnv("ADMIN_PASSWORD");
const adminFullName = process.env.ADMIN_FULL_NAME || "Administrateur ACS";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST_IPV4 || requiredEnv("DB_HOST"),
  port: Number(process.env.DB_PORT || 3306),
  user: requiredEnv("DB_USER"),
  password: requiredEnv("DB_PASSWORD"),
  database: requiredEnv("DB_NAME"),
  charset: "utf8mb4",
});

try {
  await ensureAuthTables(connection);
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await connection.execute(
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
    [adminEmail, adminFullName, passwordHash],
  );

  console.log(`Admin user ready: ${adminEmail}`);
} finally {
  await connection.end();
}
