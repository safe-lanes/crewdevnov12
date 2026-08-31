import { writeFile } from "node:fs/promises";
import { Pool } from "pg";

type Side = "development" | "fresh";
type DifferenceKind = "missing-from-fresh" | "missing-from-development" | "changed";

interface Difference {
  kind: DifferenceKind;
  key: string;
  development?: Record<string, unknown>;
  fresh?: Record<string, unknown>;
}

interface CategoryReport {
  differences: Difference[];
}

interface SeedCount {
  table: string;
  present: boolean;
  rowCount: number | null;
}

interface SeedAuditRow {
  table: string;
  development: SeedCount;
  fresh: SeedCount;
  status: string;
  onboardingGuidance: string;
}

interface SchemaReport {
  identical: boolean;
  categories: Record<string, CategoryReport>;
  seedAudit: SeedAuditRow[];
}

interface CatalogRow {
  [key: string]: unknown;
}

const SYSTEM_SCHEMAS = ["pg_catalog", "information_schema"];

const SEED_TABLES = [
  "adm_menumaster_ac",
  "adm_rolemaster_ac",
  "adm_roleaccess_ac",
  "master_vessel_types",
  "master_users",
  "master_vessels",
  "adm_forms_v2",
  "adm_rank_groups_v2",
  "adm_form_versions_v2",
  "frm_form_parts",
  "frm_option_sets",
  "frm_options",
  "frm_sections",
  "frm_questions",
  "master_nationalities",
  "master_data_entries",
] as const;

const SEED_GUIDANCE: Record<string, string> = {
  adm_menumaster_ac: "The access-control menu catalogue must exist before users can navigate the application.",
  adm_rolemaster_ac: "Roles must exist before authenticated users can resolve permissions.",
  adm_roleaccess_ac: "Role grants must exist for the seeded roles to reach application modules.",
  master_vessel_types: "Baseline vessel types support vessel and crew validation; add client-specific types during onboarding.",
  master_users: "Users are tenant-specific and must be provisioned during onboarding; fresh-chain rows must not be treated as client users.",
  master_vessels: "Vessels are tenant-specific and must be populated during onboarding.",
  adm_forms_v2: "Form definitions are needed for the configured-form workflows.",
  adm_rank_groups_v2: "Rank groups connect forms to the ranks that can use them.",
  adm_form_versions_v2: "Released or draft form versions provide the runnable form configuration.",
  frm_form_parts: "Form parts are required for a form skeleton to render.",
  frm_option_sets: "Reusable option sets are conditional; populate them during onboarding when a form uses them.",
  frm_options: "Option values are conditional; populate them during onboarding when a form uses option sets.",
  frm_sections: "Form sections are required for a form skeleton to render.",
  frm_questions: "Form questions are required for a form skeleton to render.",
  master_nationalities: "Nationality master data is used by crew and recruitment validation.",
  master_data_entries: "Shared master entries provide baseline lookup values used by application workflows.",
};

const CLIENT_ONBOARDING_TABLES = new Set(["master_users", "master_vessels"]);
const CONDITIONAL_SEED_TABLES = new Set(["frm_option_sets", "frm_options"]);

const CATEGORY_DEFINITIONS: Array<{
  name: string;
  keyFields: string[];
  query: string;
}> = [
  {
    name: "tables",
    keyFields: ["schema_name", "table_name"],
    query: `
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        c.relkind::text AS relkind,
        c.relpersistence::text AS persistence
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'f')
        AND n.nspname <> ALL($1::text[])
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, c.relname
    `,
  },
  {
    name: "columns",
    keyFields: ["table_schema", "table_name", "column_name"],
    query: `
      SELECT
        table_schema,
        table_name,
        column_name,
        data_type,
        udt_schema,
        udt_name,
        domain_schema,
        domain_name,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        datetime_precision
      FROM information_schema.columns
      WHERE table_schema <> ALL($1::text[])
        AND table_schema NOT LIKE 'pg_%'
      ORDER BY table_schema, table_name, column_name
    `,
  },
  {
    name: "constraints",
    keyFields: ["schema_name", "table_name", "constraint_name"],
    query: `
      SELECT
        n.nspname AS schema_name,
        rel.relname AS table_name,
        con.conname AS constraint_name,
        con.contype::text AS constraint_type,
        pg_get_constraintdef(con.oid, true) AS definition,
        con.convalidated AS validated,
        con.condeferrable AS deferrable,
        con.condeferred AS initially_deferred
      FROM pg_constraint AS con
      JOIN pg_class AS rel ON rel.oid = con.conrelid
      JOIN pg_namespace AS n ON n.oid = rel.relnamespace
      WHERE con.contype IN ('p', 'f', 'u', 'c', 'x')
        AND n.nspname <> ALL($1::text[])
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, rel.relname, con.conname
    `,
  },
  {
    name: "indexes",
    keyFields: ["schema_name", "table_name", "index_name"],
    query: `
      SELECT
        n.nspname AS schema_name,
        table_class.relname AS table_name,
        index_class.relname AS index_name,
        pg_get_indexdef(index_info.indexrelid) AS definition,
        index_info.indisunique AS is_unique,
        index_info.indisprimary AS is_primary,
        index_info.indisvalid AS is_valid
      FROM pg_index AS index_info
      JOIN pg_class AS index_class ON index_class.oid = index_info.indexrelid
      JOIN pg_class AS table_class ON table_class.oid = index_info.indrelid
      JOIN pg_namespace AS n ON n.oid = table_class.relnamespace
      WHERE n.nspname <> ALL($1::text[])
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, table_class.relname, index_class.relname
    `,
  },
  {
    name: "views",
    keyFields: ["schema_name", "view_name"],
    query: `
      SELECT
        n.nspname AS schema_name,
        c.relname AS view_name,
        CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' END AS view_type,
        pg_get_viewdef(c.oid, true) AS definition
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('v', 'm')
        AND n.nspname <> ALL($1::text[])
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, c.relname
    `,
  },
  {
    name: "enum-types",
    keyFields: ["schema_name", "type_name"],
    query: `
      SELECT
        n.nspname AS schema_name,
        t.typname AS type_name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type AS t
      JOIN pg_namespace AS n ON n.oid = t.typnamespace
      JOIN pg_enum AS e ON e.enumtypid = t.oid
      WHERE t.typtype = 'e'
        AND n.nspname <> ALL($1::text[])
        AND n.nspname NOT LIKE 'pg_%'
      GROUP BY n.nspname, t.typname
      ORDER BY n.nspname, t.typname
    `,
  },
  {
    name: "sequences",
    keyFields: ["schema_name", "sequence_name"],
    query: `
      SELECT
        n.nspname AS schema_name,
        c.relname AS sequence_name,
        format_type(s.seqtypid, NULL) AS data_type,
        s.seqstart AS start_value,
        s.seqincrement AS increment_value,
        s.seqmin AS minimum_value,
        s.seqmax AS maximum_value,
        s.seqcache AS cache_value,
        s.seqcycle AS cycle
      FROM pg_sequence AS s
      JOIN pg_class AS c ON c.oid = s.seqrelid
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname <> ALL($1::text[])
        AND n.nspname NOT LIKE 'pg_%'
      ORDER BY n.nspname, c.relname
    `,
  },
];

function parseFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeValue(entry)]),
    );
  }
  return value;
}

function comparableRow(row: CatalogRow): Record<string, unknown> {
  return normalizeValue(row) as Record<string, unknown>;
}

function rowKey(row: CatalogRow, keyFields: string[]): string {
  return keyFields.map((field) => String(row[field] ?? "")).join(".");
}

function compareCategory(
  keyFields: string[],
  developmentRows: CatalogRow[],
  freshRows: CatalogRow[],
): Difference[] {
  const developmentByKey = new Map(
    developmentRows.map((row) => [rowKey(row, keyFields), comparableRow(row)]),
  );
  const freshByKey = new Map(
    freshRows.map((row) => [rowKey(row, keyFields), comparableRow(row)]),
  );
  const keys = Array.from(new Set([...developmentByKey.keys(), ...freshByKey.keys()])).sort();
  const differences: Difference[] = [];

  for (const key of keys) {
    const development = developmentByKey.get(key);
    const fresh = freshByKey.get(key);

    if (!development) {
      differences.push({ kind: "missing-from-development", key, fresh });
      continue;
    }
    if (!fresh) {
      differences.push({ kind: "missing-from-fresh", key, development });
      continue;
    }
    if (JSON.stringify(development) !== JSON.stringify(fresh)) {
      differences.push({ kind: "changed", key, development, fresh });
    }
  }

  return differences;
}

async function readSchema(pool: Pool): Promise<Record<string, CatalogRow[]>> {
  const snapshot: Record<string, CatalogRow[]> = {};
  for (const category of CATEGORY_DEFINITIONS) {
    const result = await pool.query<CatalogRow>(category.query, [SYSTEM_SCHEMAS]);
    snapshot[category.name] = result.rows;
  }
  return snapshot;
}

async function readSeedCounts(pool: Pool): Promise<Map<string, SeedCount>> {
  const presentResult = await pool.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [SEED_TABLES],
  );
  const presentTables = new Set(presentResult.rows.map((row) => row.table_name));
  const counts = new Map<string, SeedCount>();

  for (const table of SEED_TABLES) {
    if (!presentTables.has(table)) {
      counts.set(table, { table, present: false, rowCount: null });
      continue;
    }

    const safeTable = quoteIdentifier(table);
    const countResult = await pool.query<{ row_count: string }>(
      `SELECT COUNT(*)::text AS row_count FROM public.${safeTable}`,
    );
    counts.set(table, {
      table,
      present: true,
      rowCount: Number(countResult.rows[0]?.row_count ?? 0),
    });
  }

  return counts;
}

function seedStatus(table: string, fresh: SeedCount): string {
  if (CLIENT_ONBOARDING_TABLES.has(table)) {
    return "Must populate during onboarding";
  }
  if (CONDITIONAL_SEED_TABLES.has(table)) {
    return fresh.present && (fresh.rowCount ?? 0) > 0
      ? "Baseline present; extend during onboarding when needed"
      : "Conditional; populate during onboarding when the selected forms require it";
  }
  if (!fresh.present || fresh.rowCount === 0) {
    return "Must populate during onboarding";
  }
  return "Sufficient baseline for a new client";
}

function seedGuidance(table: string, status: string): string {
  const guidance = SEED_GUIDANCE[table] ?? "Review this table during onboarding.";
  if (status === "Must populate during onboarding") {
    return `${guidance} The fresh chain has no usable baseline rows.`;
  }
  return guidance;
}

async function buildSeedAudit(
  developmentPool: Pool,
  freshPool: Pool,
): Promise<SeedAuditRow[]> {
  const [developmentCounts, freshCounts] = await Promise.all([
    readSeedCounts(developmentPool),
    readSeedCounts(freshPool),
  ]);

  return SEED_TABLES.map((table) => {
    const development = developmentCounts.get(table);
    const fresh = freshCounts.get(table);
    if (!development || !fresh) {
      throw new Error(`Missing seed count for ${table}`);
    }
    const status = seedStatus(table, fresh);
    return {
      table,
      development,
      fresh,
      status,
      onboardingGuidance: seedGuidance(table, status),
    };
  });
}

function formatValue(value: unknown): string {
  return JSON.stringify(value);
}

function buildHumanReport(report: SchemaReport): string {
  const lines: string[] = [
    "MIGRATION SCHEMA COMPARISON",
    "===========================",
    `Schema identical: ${report.identical ? "YES" : "NO"}`,
    "",
    "SCHEMA DIFFERENCES",
    "------------------",
  ];

  let totalDifferences = 0;
  for (const [category, result] of Object.entries(report.categories)) {
    totalDifferences += result.differences.length;
    lines.push(`${category}: ${result.differences.length} difference(s)`);
    for (const difference of result.differences) {
      lines.push(`  [${difference.kind}] ${difference.key}`);
      if (difference.development && difference.fresh) {
        lines.push(`    development: ${formatValue(difference.development)}`);
        lines.push(`    fresh:       ${formatValue(difference.fresh)}`);
      } else if (difference.development) {
        lines.push(`    development: ${formatValue(difference.development)}`);
      } else {
        lines.push(`    fresh:       ${formatValue(difference.fresh)}`);
      }
    }
    lines.push("");
  }
  lines.push(`Total schema differences: ${totalDifferences}`);
  lines.push("");
  lines.push("SEED DATA ONBOARDING CHECKLIST");
  lines.push("==============================");
  lines.push("Counts are exact row counts read independently from each database.");
  lines.push("");
  lines.push("table | development rows | fresh rows | status | onboarding guidance");
  lines.push("----- | ----------------- | ---------- | ------ | -------------------");
  for (const entry of report.seedAudit) {
    const developmentRows = entry.development.present
      ? String(entry.development.rowCount)
      : "TABLE MISSING";
    const freshRows = entry.fresh.present ? String(entry.fresh.rowCount) : "TABLE MISSING";
    lines.push(
      `${entry.table} | ${developmentRows} | ${freshRows} | ${entry.status} | ${entry.onboardingGuidance}`,
    );
  }
  lines.push("");
  lines.push(
    "This checklist describes what a new client receives from the migration chain and what onboarding must provide; it is not a defect list.",
  );
  return lines.join("\n");
}

async function main(): Promise<number> {
  const developmentUrl = process.env.DEV_DATABASE_URL;
  const freshUrl = process.env.FRESH_DATABASE_URL;
  const jsonPath = parseFlag("--json-out");
  const textPath = parseFlag("--text-out");

  if (!developmentUrl || !freshUrl) {
    throw new Error("DEV_DATABASE_URL and FRESH_DATABASE_URL are required");
  }
  if (developmentUrl === freshUrl) {
    throw new Error("DEV_DATABASE_URL and FRESH_DATABASE_URL must point to different databases");
  }

  const developmentPool = new Pool({ connectionString: developmentUrl });
  const freshPool = new Pool({ connectionString: freshUrl });

  try {
    const [developmentSchema, freshSchema] = await Promise.all([
      readSchema(developmentPool),
      readSchema(freshPool),
    ]);
    const categories: Record<string, CategoryReport> = {};

    for (const category of CATEGORY_DEFINITIONS) {
      categories[category.name] = {
        differences: compareCategory(
          category.keyFields,
          developmentSchema[category.name] ?? [],
          freshSchema[category.name] ?? [],
        ),
      };
    }

    const seedAudit = await buildSeedAudit(developmentPool, freshPool);
    const identical = Object.values(categories).every(
      (category) => category.differences.length === 0,
    );
    const report: SchemaReport = { identical, categories, seedAudit };
    const humanReport = buildHumanReport(report);

    if (jsonPath) {
      await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }
    if (textPath) {
      await writeFile(textPath, `${humanReport}\n`, "utf8");
    }
    console.log(humanReport);
    return identical ? 0 : 1;
  } finally {
    await Promise.all([developmentPool.end(), freshPool.end()]);
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });