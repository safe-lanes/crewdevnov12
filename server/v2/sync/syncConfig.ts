// Table classification for sync (SYN-01), read from sync_table_config.
// Only BOTH_EDITABLE tables are field-logged. Loaded once and cached;
// call refreshSyncConfig() after editing the table.
//
// Some databases also carry a trigger-based capture (sync_log_changes()) on a
// few tables. The sink must not log those again, so they are read here too.

import { sql } from "drizzle-orm";

export interface TableSyncConfig {
  tableName: string;
  category: string;
  identityColumn: string;
  scopeMode: string;
  vesselColumn: string | null;
  skipColumns: string[];
  // SQL predicate a row must meet to be sent as a whole row (null = every row).
  // Written by migrations only: it is pasted into the gather query.
  rowFilter: string | null;
  // For scopeMode 'parent': the join to the table that carries the vessel.
  parent: { table: string; fkColumn: string; identityColumn: string } | null;
}

type Queryable = { execute: (q: any) => Promise<any> };

interface Loaded {
  tables: Map<string, TableSyncConfig>;
  triggerTables: Set<string>;
}

let cache: Loaded | null = null;

const rowsOf = (res: any): any[] => res?.rows ?? res ?? [];

export async function refreshSyncConfig(db: Queryable): Promise<Map<string, TableSyncConfig>> {
  const cfgRows = rowsOf(
    await db.execute(
      sql`SELECT table_name, category, identity_column, scope_mode, vessel_column, skip_columns,
             row_filter, parent_table, parent_fk_column, parent_identity_column
      FROM sync_table_config`,
    ),
  );
  const tables = new Map<string, TableSyncConfig>();
  for (const r of cfgRows) {
    tables.set(r.table_name, {
      tableName: r.table_name,
      category: r.category,
      identityColumn: r.identity_column,
      scopeMode: r.scope_mode,
      vesselColumn: r.vessel_column ?? null,
      skipColumns: Array.isArray(r.skip_columns) ? r.skip_columns : [],
      rowFilter: r.row_filter ?? null,
      parent:
        r.parent_table && r.parent_fk_column && r.parent_identity_column
          ? { table: r.parent_table, fkColumn: r.parent_fk_column, identityColumn: r.parent_identity_column }
          : null,
    });
  }
  const trigRows = rowsOf(
    await db.execute(sql`
      SELECT c.relname AS table_name
      FROM pg_trigger tg
      JOIN pg_proc p ON p.oid = tg.tgfoid
      JOIN pg_class c ON c.oid = tg.tgrelid
      WHERE NOT tg.tgisinternal AND p.proname = 'sync_log_changes'
    `),
  );
  cache = { tables, triggerTables: new Set(trigRows.map((r) => r.table_name)) };
  return tables;
}

async function loaded(db: Queryable): Promise<Loaded> {
  if (!cache) await refreshSyncConfig(db);
  return cache!;
}

export async function getTableSyncConfig(db: Queryable, table: string): Promise<TableSyncConfig | undefined> {
  return (await loaded(db)).tables.get(table);
}

// True when the sink must log this table: BOTH_EDITABLE and not already
// captured by the database trigger.
export async function requiresFieldLogging(db: Queryable, table: string): Promise<boolean> {
  const { tables, triggerTables } = await loaded(db);
  const cfg = tables.get(table);
  return !!cfg && cfg.category === "BOTH_EDITABLE" && !triggerTables.has(table);
}

// Tables synced as whole rows, by direction:
//   pull: ONE_WAY_SHORE_TO_SHIP (shore sends, ship receives)
//   push: SHIP_ONLY (ship sends, shore receives)
// BOTH_EDITABLE tables travel as field logs instead.
export async function tablesByCategory(db: Queryable, category: string): Promise<TableSyncConfig[]> {
  return [...(await loaded(db)).tables.values()].filter((c) => c.category === category);
}

// For tests.
export function resetSyncConfigCache(): void {
  cache = null;
}
