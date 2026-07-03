import fs from "node:fs/promises";
import mysql from "mysql2/promise";

function loadEnvFile(file = ".env.local") {
  return fs
    .readFile(file, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
      }
    })
    .catch(() => undefined);
}

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function idListOption(name) {
  return String(option(name, ""))
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
}

function requiredEnv(name) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
}

function buildWhere({ ids, fromId, limit, overwrite }) {
  const where = [
    "e.body_text IS NOT NULL",
    "CHAR_LENGTH(TRIM(e.body_text)) > 0",
  ];
  const values = [];
  let limitSql = "";

  if (ids.length) {
    where.push(`e.id IN (${ids.map(() => "?").join(", ")})`);
    values.push(...ids);
  } else {
    where.push("e.id > ?");
    values.push(fromId);
    limitSql = "LIMIT ?";
    values.push(limit);
  }

  if (!overwrite) {
    where.push(`(
      b.message_id IS NULL
      OR (
        CHAR_LENGTH(TRIM(COALESCE(b.body_text, ''))) = 0
        AND CHAR_LENGTH(TRIM(COALESCE(b.body_html, ''))) = 0
        AND CHAR_LENGTH(TRIM(COALESCE(b.body_preview, ''))) = 0
      )
    )`);
  }

  return {
    whereSql: where.join("\n      AND "),
    limitSql,
    values,
  };
}

async function main() {
  await loadEnvFile();

  const ids = idListOption("ids");
  const fromId = Number(option("from-id", "0"));
  const limit = Number(option("limit", "1000"));
  const overwrite = flag("overwrite");
  const dryRun = flag("dry-run");

  const db = await mysql.createConnection({
    host: process.env.DB_HOST_IPV4 || requiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT || 3306),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    connectTimeout: 15000,
    charset: "utf8mb4",
  });

  try {
    const { whereSql, limitSql, values } = buildWhere({
      ids,
      fromId,
      limit,
      overwrite,
    });

    const [previewRows] = await db.query(
      `
      SELECT e.id, CHAR_LENGTH(e.body_text) AS body_length
      FROM email_messages e
      LEFT JOIN email_message_bodies b ON b.message_id = e.id
      WHERE ${whereSql}
      ORDER BY e.id ASC
      ${limitSql}
      `,
      values,
    );

    if (!dryRun && previewRows.length) {
      await db.query(
        `
        INSERT INTO email_message_bodies
          (message_id, body_text, body_preview, body_length, extraction_status, extracted_at)
        SELECT
          e.id,
          e.body_text,
          LEFT(TRIM(e.body_text), 500),
          CHAR_LENGTH(e.body_text),
          'legacy_email_messages',
          NOW()
        FROM email_messages e
        LEFT JOIN email_message_bodies b ON b.message_id = e.id
        WHERE ${whereSql}
        ORDER BY e.id ASC
        ${limitSql}
        ON DUPLICATE KEY UPDATE
          body_text = VALUES(body_text),
          body_preview = VALUES(body_preview),
          body_length = VALUES(body_length),
          extraction_status = VALUES(extraction_status),
          extracted_at = VALUES(extracted_at),
          updated_at = CURRENT_TIMESTAMP
        `,
        values,
      );
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          ids,
          fromId,
          limit,
          overwrite,
          matched: previewRows.length,
          firstId: previewRows[0]?.id ?? null,
          lastId: previewRows.at(-1)?.id ?? null,
          note: dryRun
            ? "Aucune ecriture effectuee."
            : "Synchronisation terminee depuis email_messages.body_text.",
        },
        null,
        2,
      ),
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
