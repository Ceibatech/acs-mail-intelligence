import type { RowDataPacket } from "mysql2/promise";
import { queryRows, queryOne, tableExists } from "@/lib/db";

const fields = ["e.subject", "e.from_header", "e.to_header", "e.body_text"];

const categories = [
  {
    key: "sinistres",
    label: "Sinistres",
    keywords: [
      "sinistre",
      "accident",
      "déclaration",
      "remboursement",
      "indemnisation",
      "prise en charge",
    ],
  },
  {
    key: "devis",
    label: "Demandes de devis",
    keywords: ["devis", "cotation", "proposition", "offre", "tarification"],
  },
  {
    key: "relances",
    label: "Relances",
    keywords: ["relance", "rappel", "dans l'attente", "retour attendu", "merci de revenir"],
  },
  {
    key: "renouvellements",
    label: "Renouvellements",
    keywords: ["renouvellement", "échéance", "contrat", "police", "reconduction"],
  },
  {
    key: "reclamations",
    label: "Réclamations",
    keywords: ["réclamation", "plainte", "insatisfaction", "litige", "contestation"],
  },
  {
    key: "attestations",
    label: "Attestations",
    keywords: ["attestation", "certificat", "police d'assurance", "justificatif"],
  },
  {
    key: "branches",
    label: "Branches assurance",
    keywords: [
      "auto",
      "santé",
      "IARD",
      "vie",
      "transport",
      "responsabilité civile",
      "multirisque",
      "flotte",
    ],
  },
];

const urgentKeywords = [
  "urgent",
  "immédiat",
  "critique",
  "bloqué",
  "retard",
  "dernier délai",
  "mise en demeure",
];

function keywordClause(keywords: string[]) {
  const fragments: string[] = [];
  const values: string[] = [];

  for (const field of fields) {
    for (const keyword of keywords) {
      fragments.push(`${field} LIKE ?`);
      values.push(`%${keyword}%`);
    }
  }

  return {
    sql: `(${fragments.join(" OR ")})`,
    values,
  };
}

function numberValue(value: unknown) {
  return Number(value || 0);
}

let analyticsCache: AnalyticsResponse | null = null;
let analyticsCacheTimestamp = 0;
const ANALYTICS_CACHE_TTL = 15_000;

type Category = {
  key: string;
  label: string;
  total: number;
  trend: Array<{ month: string; total: number }>;
};

type AnalyticsResponse = {
  categories: Category[];
  topMailboxesForSinistres: Array<{ email_address: string; total: number }>;
  topSendersForReclamations: Array<{ from_header: string; total: number }>;
  pendingFollowups: Array<Record<string, string | number>>;
  urgentEmails: Array<Record<string, string | number | null>>;
  inactiveMailboxes: Array<Record<string, string | number | null>>;
  highVolumeSenders: Array<Record<string, string | number | null>>;
};

export async function getInsuranceAnalytics() {
  if (analyticsCache && Date.now() - analyticsCacheTimestamp < ANALYTICS_CACHE_TTL) {
    return analyticsCache;
  }

  const categoryClauses = categories.map((category) => ({
    ...category,
    clause: keywordClause(category.keywords),
  }));

  const summaryQuery = `
    SELECT
      ${categoryClauses
        .map((category) => `SUM((${category.clause.sql})) AS ${category.key}_total`)
        .join(",\n      ")}
    FROM email_messages e
  `;

  const summaryValues = categoryClauses.flatMap((category) => category.clause.values);
  const summaryRow = await queryOne<RowDataPacket>(summaryQuery, summaryValues);

  const trendQuery = `
    SELECT
      DATE_FORMAT(COALESCE(e.email_date, e.imported_at), '%Y-%m') AS month,
      ${categoryClauses
        .map((category) => `SUM((${category.clause.sql})) AS ${category.key}_total`)
        .join(",\n      ")}
    FROM email_messages e
    GROUP BY month
    ORDER BY month DESC
    LIMIT 18
  `;

  const trendValues = categoryClauses.flatMap((category) => category.clause.values);
  const trendRows = await queryRows<RowDataPacket>(trendQuery, trendValues);

  const categoryResults = categoryClauses.map((category) => ({
    key: category.key,
    label: category.label,
    total: numberValue(summaryRow?.[`${category.key}_total`]),
    trend: trendRows
      .slice()
      .reverse()
      .map((row) => ({
        month: String(row.month),
        total: numberValue(row[`${category.key}_total`]),
      })),
  }));

  const sinistreClause = keywordClause(categories[0].keywords);
  const reclamationClause = keywordClause(categories[4].keywords);
  const urgentClause = keywordClause(urgentKeywords);
  const hasFollowups = await tableExists("followups");

  const [
    topMailboxesForSinistres,
    topSendersForReclamations,
    urgentEmails,
    inactiveMailboxes,
    highVolumeSenders,
    pendingFollowups,
  ] = await Promise.all([
    queryRows<RowDataPacket & { email_address: string; total: number }>(
      `
      SELECT m.email_address, COUNT(e.id) AS total
      FROM email_messages e
      JOIN mailboxes m ON m.id = e.mailbox_id
      WHERE ${sinistreClause.sql}
      GROUP BY m.email_address
      ORDER BY total DESC
      LIMIT 10
      `,
      sinistreClause.values,
    ),
    queryRows<RowDataPacket & { from_header: string; total: number }>(
      `
      SELECT e.from_header, COUNT(*) AS total
      FROM email_messages e
      WHERE ${reclamationClause.sql}
        AND e.from_header IS NOT NULL
        AND e.from_header <> ''
      GROUP BY e.from_header
      ORDER BY total DESC
      LIMIT 10
      `,
      reclamationClause.values,
    ),
    queryRows<RowDataPacket>(
      `
      SELECT
        e.id,
        m.email_address AS mailbox,
        e.email_date,
        e.imported_at,
        e.from_header,
        e.subject
      FROM email_messages e
      JOIN mailboxes m ON m.id = e.mailbox_id
      WHERE ${urgentClause.sql}
      ORDER BY COALESCE(e.email_date, e.imported_at) DESC
      LIMIT 20
      `,
      urgentClause.values,
    ),
    queryRows<RowDataPacket>(
      `
      SELECT
        m.email_address,
        MAX(COALESCE(e.email_date, e.imported_at)) AS last_activity,
        COUNT(e.id) AS total
      FROM mailboxes m
      LEFT JOIN email_messages e ON e.mailbox_id = m.id
      GROUP BY m.id, m.email_address
      HAVING last_activity < DATE_SUB(NOW(), INTERVAL 90 DAY)
         OR last_activity IS NULL
      ORDER BY last_activity ASC
      LIMIT 20
      `,
    ),
    queryRows<RowDataPacket>(
      `
      SELECT
        from_header,
        COUNT(*) AS total,
        MAX(COALESCE(email_date, imported_at)) AS last_activity
      FROM email_messages
      WHERE from_header IS NOT NULL AND from_header <> ''
      GROUP BY from_header
      ORDER BY total DESC
      LIMIT 20
      `,
    ),
    hasFollowups
      ? queryRows<RowDataPacket>(
          `
          SELECT
            status,
            priority,
            COUNT(*) AS total
          FROM followups
          WHERE status <> 'closed'
          GROUP BY status, priority
          ORDER BY total DESC
          `,
        )
      : Promise.resolve([]),
  ]);

  const result: AnalyticsResponse = {
    categories: categoryResults,
    topMailboxesForSinistres: topMailboxesForSinistres.map((row) => ({
      email_address: row.email_address,
      total: numberValue(row.total),
    })),
    topSendersForReclamations: topSendersForReclamations.map((row) => ({
      from_header: row.from_header,
      total: numberValue(row.total),
    })),
    pendingFollowups,
    urgentEmails,
    inactiveMailboxes,
    highVolumeSenders,
  };

  analyticsCache = result;
  analyticsCacheTimestamp = Date.now();
  return result;
}
