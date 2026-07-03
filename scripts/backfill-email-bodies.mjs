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

function idListOption(name) {
  return String(option(name, ""))
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
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

function collectTextParts(raw, collected = { plain: [], html: [], htmlText: [] }) {
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
    const html = cleanText(decodeText(body, headers));
    const text = cleanText(stripHtml(html));
    if (html) collected.html.push(html);
    if (text) collected.htmlText.push(text);
    return collected;
  }

  return collected;
}

function extractEmailBody(raw, maxChars) {
  const collected = collectTextParts(raw);
  const bodyText = cleanText(
    collected.plain.join("\n\n").trim() || collected.htmlText.join("\n\n").trim(),
  ).slice(0, maxChars);
  const bodyHtml = cleanText(collected.html.join("\n\n").trim()).slice(0, maxChars);
  const bodyPreview = bodyText.replace(/\s+/g, " ").trim().slice(0, 500);

  return { bodyText, bodyHtml, bodyPreview };
}

function validateTarget(target) {
  if (["bodies", "email_messages", "both"].includes(target)) return target;
  throw new Error("--target must be bodies, email_messages, or both");
}

function hasReadableBody(extracted) {
  return Boolean(extracted.bodyText || extracted.bodyHtml || extracted.bodyPreview);
}

function extractionPayload(extracted, status = "success", error = null) {
  return {
    bodyText: extracted.bodyText || null,
    bodyHtml: extracted.bodyHtml || null,
    bodyPreview: extracted.bodyPreview || null,
    bodyLength: extracted.bodyText ? extracted.bodyText.length : 0,
    htmlLength: extracted.bodyHtml ? extracted.bodyHtml.length : 0,
    status,
    error,
  };
}

async function upsertBodyRow(db, messageId, payload) {
  await db.execute(
    `
    INSERT INTO email_message_bodies
      (message_id, body_text, body_html, body_preview, body_length, html_length,
       extraction_status, extraction_error, extracted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      body_text = VALUES(body_text),
      body_html = VALUES(body_html),
      body_preview = VALUES(body_preview),
      body_length = VALUES(body_length),
      html_length = VALUES(html_length),
      extraction_status = VALUES(extraction_status),
      extraction_error = VALUES(extraction_error),
      extracted_at = VALUES(extracted_at),
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      messageId,
      payload.bodyText,
      payload.bodyHtml,
      payload.bodyPreview,
      payload.bodyLength,
      payload.htmlLength,
      payload.status,
      payload.error,
    ],
  );
}

function candidateQuery(target, retryFailed, ids = []) {
  if (ids.length) {
    return `
      SELECT e.id, e.raw_path
      FROM email_messages e
      WHERE e.id IN (${ids.map(() => "?").join(", ")})
        AND e.raw_path IS NOT NULL
      ORDER BY e.id ASC
    `;
  }

  if (target === "email_messages") {
    return `
      SELECT id, raw_path
      FROM email_messages
      WHERE id > ?
        AND raw_path IS NOT NULL
        AND (body_text IS NULL OR CHAR_LENGTH(TRIM(body_text)) = 0)
      ORDER BY id ASC
      LIMIT ?
    `;
  }

  return `
    SELECT e.id, e.raw_path
    FROM email_messages e
    LEFT JOIN email_message_bodies b ON b.message_id = e.id
    WHERE e.id > ?
      AND e.raw_path IS NOT NULL
      AND (
        b.message_id IS NULL
        ${retryFailed ? "OR b.extraction_status IN ('error', 'missing_file')" : ""}
        OR (
          b.extraction_status = 'success'
          AND CHAR_LENGTH(TRIM(COALESCE(b.body_text, ''))) = 0
          AND CHAR_LENGTH(TRIM(COALESCE(b.body_html, ''))) = 0
        )
      )
    ORDER BY e.id ASC
    LIMIT ?
  `;
}

async function main() {
  await loadEnvFile();

  const limit = Number(option("limit", "1000"));
  const batchSize = Number(option("batch-size", "100"));
  const fromId = Number(option("from-id", "0"));
  const maxBodyChars = Number(option("max-body-chars", "50000"));
  const target = validateTarget(option("target", "bodies"));
  const ids = idListOption("ids");
  const dryRun = flag("dry-run");
  const retryFailed = flag("retry-failed");

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
        candidateQuery(target, retryFailed, ids),
        ids.length ? ids : [lastId, Math.min(batchSize, limit - scanned)],
      );

      if (!rows.length) break;

      for (const row of rows) {
        lastId = Number(row.id);
        scanned += 1;

        try {
          const raw = await fs.readFile(row.raw_path);
          const extracted = extractEmailBody(raw, maxBodyChars);
          if (!hasReadableBody(extracted)) {
            if (!dryRun && target !== "email_messages") {
              await upsertBodyRow(
                db,
                row.id,
                extractionPayload(extracted, "empty", null),
              );
            }
            empty += 1;
            continue;
          }

          if (!dryRun) {
            if (target !== "email_messages") {
              await upsertBodyRow(db, row.id, extractionPayload(extracted));
            }
            if (target !== "bodies") {
              await db.execute(
                "UPDATE email_messages SET body_text = ?, has_body = 1 WHERE id = ?",
                [extracted.bodyText || extracted.bodyPreview, row.id],
              );
            }
          }
          updated += 1;
        } catch (error) {
          if (error && error.code === "ENOENT") {
            if (!dryRun && target !== "email_messages") {
              await upsertBodyRow(
                db,
                row.id,
                extractionPayload(
                  { bodyText: "", bodyHtml: "", bodyPreview: "" },
                  "missing_file",
                  error.message,
                ),
              );
            }
            missing += 1;
          } else {
            if (!dryRun && target !== "email_messages") {
              await upsertBodyRow(
                db,
                row.id,
                extractionPayload(
                  { bodyText: "", bodyHtml: "", bodyPreview: "" },
                  "error",
                  error instanceof Error ? error.message : String(error),
                ),
              );
            }
            failed += 1;
          }
        }
      }

      if (ids.length) break;
    }
  } finally {
    await db.end();
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        target,
        ids,
        retryFailed,
        scanned,
        updated,
        empty,
        missing,
        failed,
        lastId,
        nextCommand: ids.length
          ? null
          : `npm run email:backfill-bodies -- --target=${target} --from-id=${lastId}`,
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
