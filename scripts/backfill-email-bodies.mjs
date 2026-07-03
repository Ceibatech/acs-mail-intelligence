import fs from "node:fs/promises";
import { TextDecoder } from "node:util";
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

function option(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeCharset(charset) {
  const value = String(charset || "utf-8").trim().toLowerCase();
  if (value === "iso-8859-1" || value === "latin1") return "windows-1252";
  if (value === "us-ascii") return "utf-8";
  return value || "utf-8";
}

function decodeQuotedPrintable(value) {
  const cleaned = value.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let index = 0; index < cleaned.length; index += 1) {
    if (
      cleaned[index] === "=" &&
      /[0-9a-fA-F]{2}/.test(cleaned.slice(index + 1, index + 3))
    ) {
      bytes.push(Number.parseInt(cleaned.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(cleaned.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function decodeTransfer(body, encoding) {
  const transfer = String(encoding || "7bit").trim().toLowerCase();
  if (transfer === "base64") {
    return Buffer.from(body.toString("latin1").replace(/\s+/g, ""), "base64");
  }
  if (transfer === "quoted-printable") {
    return decodeQuotedPrintable(body.toString("latin1"));
  }
  return body;
}

function decodeText(body, headers) {
  const transferDecoded = decodeTransfer(
    body,
    headers["content-transfer-encoding"],
  );
  const charset = parseContentType(headers["content-type"]).params.charset;

  try {
    return new TextDecoder(normalizeCharset(charset), { fatal: false }).decode(
      transferDecoded,
    );
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(transferDecoded);
  }
}

function splitHeaderBody(raw) {
  const asLatin1 = raw.toString("latin1");
  const separator = asLatin1.match(/\r?\n\r?\n/);
  if (!separator || separator.index === undefined) {
    return { header: "", body: raw };
  }

  const headerEnd = separator.index;
  const bodyStart = headerEnd + separator[0].length;
  return {
    header: asLatin1.slice(0, headerEnd),
    body: raw.subarray(bodyStart),
  };
}

function parseHeaders(headerText) {
  const headers = {};
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }
  return headers;
}

function parseContentType(value) {
  const [type = "text/plain", ...rawParams] = String(value || "text/plain")
    .split(";")
    .map((part) => part.trim());
  const params = {};
  for (const param of rawParams) {
    const separator = param.indexOf("=");
    if (separator <= 0) continue;
    const key = param.slice(0, separator).trim().toLowerCase();
    params[key] = param
      .slice(separator + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }
  return { type: type.toLowerCase(), params };
}

function splitMultipart(body, boundary) {
  if (!boundary) return [];
  const marker = `--${boundary}`;
  const text = body.toString("latin1");
  return text
    .split(marker)
    .slice(1)
    .filter((part) => !part.startsWith("--"))
    .map((part) => part.replace(/^\r?\n/, "").replace(/\r?\n$/, ""))
    .map((part) => Buffer.from(part, "latin1"));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function collectTextParts(raw, collected = { plain: [], html: [] }) {
  const { header, body } = splitHeaderBody(raw);
  const headers = parseHeaders(header);
  const contentType = parseContentType(headers["content-type"]);
  const disposition = String(headers["content-disposition"] || "").toLowerCase();
  if (disposition.includes("attachment")) return collected;

  if (contentType.type.startsWith("multipart/")) {
    for (const part of splitMultipart(body, contentType.params.boundary)) {
      collectTextParts(part, collected);
    }
    return collected;
  }

  if (contentType.type === "text/plain") {
    const text = cleanText(decodeText(body, headers));
    if (text) collected.plain.push(text);
    return collected;
  }

  if (contentType.type === "text/html") {
    const text = cleanText(stripHtml(decodeText(body, headers)));
    if (text) collected.html.push(text);
    return collected;
  }

  return collected;
}

function extractEmailBody(raw, maxChars) {
  const collected = collectTextParts(raw);
  const text = collected.plain.join("\n\n").trim() || collected.html.join("\n\n").trim();
  return cleanText(text).slice(0, maxChars);
}

async function main() {
  await loadEnvFile();

  const limit = Number(option("limit", "1000"));
  const batchSize = Number(option("batch-size", "100"));
  const fromId = Number(option("from-id", "0"));
  const maxBodyChars = Number(option("max-body-chars", "50000"));
  const dryRun = flag("dry-run");

  const db = await mysql.createConnection({
    host: process.env.DB_HOST_IPV4 || process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 15000,
  });

  let lastId = fromId;
  let scanned = 0;
  let updated = 0;
  let empty = 0;
  let missing = 0;
  let failed = 0;

  try {
    while (scanned < limit) {
      const [rows] = await db.query(
        `
        SELECT id, raw_path
        FROM email_messages
        WHERE id > ?
          AND raw_path IS NOT NULL
          AND (body_text IS NULL OR CHAR_LENGTH(TRIM(body_text)) = 0)
        ORDER BY id ASC
        LIMIT ?
        `,
        [lastId, Math.min(batchSize, limit - scanned)],
      );

      if (!rows.length) break;

      for (const row of rows) {
        lastId = Number(row.id);
        scanned += 1;

        try {
          const raw = await fs.readFile(row.raw_path);
          const body = extractEmailBody(raw, maxBodyChars);
          if (!body) {
            empty += 1;
            continue;
          }

          if (!dryRun) {
            await db.execute(
              "UPDATE email_messages SET body_text = ?, has_body = 1 WHERE id = ?",
              [body, row.id],
            );
          }
          updated += 1;
        } catch (error) {
          if (error && error.code === "ENOENT") {
            missing += 1;
          } else {
            failed += 1;
          }
        }
      }
    }
  } finally {
    await db.end();
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned,
        updated,
        empty,
        missing,
        failed,
        lastId,
        nextCommand: `npm run email:backfill-bodies -- --from-id=${lastId}`,
      },
      null,
      2,
    ),
  );
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
