import mysql, {
  type Pool,
  type PoolOptions,
  type RowDataPacket,
} from "mysql2/promise";

let pool: Pool | null = null;
const tableExistenceCache = new Map<string, boolean>();
const columnExistenceCache = new Map<string, boolean>();

const expectedTables = [
  "mailboxes",
  "email_messages",
  "email_message_bodies",
  "app_users",
  "app_sessions",
  "app_login_attempts",
  "etl_runs",
  "etl_errors",
  "email_tags",
  "followups",
  "message_share_logs",
  "audit_logs",
];

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function databaseHost() {
  return process.env.DB_HOST_IPV4 || requiredEnv("DB_HOST");
}

export function getDb() {
  if (!pool) {
    const config: PoolOptions = {
      host: databaseHost(),
      port: Number(process.env.DB_PORT || 3306),
      user: requiredEnv("DB_USER"),
      password: requiredEnv("DB_PASSWORD"),
      database: requiredEnv("DB_NAME"),
      connectTimeout: 15000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      decimalNumbers: true,
      enableKeepAlive: true,
    };

    pool = mysql.createPool(config);
  }

  return pool;
}

export function formatDbError(error: unknown) {
  if (!(error instanceof Error)) return "Connexion base de données impossible.";

  const code = (error as Error & { code?: string }).code;
  if (code === "ETIMEDOUT") {
    return "Timeout réseau vers MySQL. Vérifie Remote MySQL/cPanel, le pare-feu et l'autorisation de l'origine qui exécute Next.js.";
  }
  if (code === "ECONNREFUSED") {
    return "Connexion refusée par MySQL. Vérifie DB_HOST, DB_PORT et l'accès distant.";
  }
  if (code === "ER_ACCESS_DENIED_ERROR") {
    return "Accès MySQL refusé. Vérifie DB_USER et DB_PASSWORD.";
  }
  if (error.message) return error.message;

  return "Connexion base de données impossible.";
}

export async function queryRows<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  values: unknown[] = [],
) {
  const [rows] = await getDb().query<T[]>(sql, values);
  return rows;
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  values: unknown[] = [],
) {
  const rows = await queryRows<T>(sql, values);
  return rows[0] ?? null;
}

export async function tableExists(tableName: string) {
  if (tableExistenceCache.has(tableName)) {
    return tableExistenceCache.get(tableName) ?? false;
  }

  const row = await queryOne<RowDataPacket & { total: number }>(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ?
    `,
    [tableName],
  );

  const exists = Number(row?.total || 0) > 0;
  tableExistenceCache.set(tableName, exists);
  return exists;
}

export async function columnExists(tableName: string, columnName: string) {
  const key = `${tableName}.${columnName}`;
  if (columnExistenceCache.has(key)) {
    return columnExistenceCache.get(key) ?? false;
  }

  const row = await queryOne<RowDataPacket & { total: number }>(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND column_name = ?
    `,
    [tableName, columnName],
  );

  const exists = Number(row?.total || 0) > 0;
  columnExistenceCache.set(key, exists);
  return exists;
}

export async function databaseHealth() {
  const startedAt = Date.now();
  const row = await queryOne<RowDataPacket & { ok: number }>("SELECT 1 AS ok");
  const tables = await Promise.all(
    expectedTables.map(async (name) => {
      const exists = await tableExists(name);
      const count =
        exists && (name === "mailboxes" || name === "email_messages")
          ? await queryOne<RowDataPacket & { total: number }>(
              `SELECT COUNT(*) AS total FROM ${name}`,
            )
          : null;

      return {
        name,
        exists,
        count: count ? Number(count.total || 0) : null,
      };
    }),
  );

  return {
    ok: row?.ok === 1,
    latencyMs: Date.now() - startedAt,
    appName: process.env.APP_NAME || "ACS Mail Intelligence",
    database: process.env.DB_NAME || null,
    hostConfigured: Boolean(process.env.DB_HOST),
    hostOverrideConfigured: Boolean(process.env.DB_HOST_IPV4),
    userConfigured: Boolean(process.env.DB_USER),
    passwordConfigured: Boolean(process.env.DB_PASSWORD),
    tables,
  };
}
