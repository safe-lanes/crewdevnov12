// Maps a Drizzle row key (camelCase property) to its SQL column name.
// A plain camel-to-snake conversion is wrong for some columns (for example
// selectedVesselTypeForA23b is selected_vessel_type_for_a2_3b), so the real
// column names are read from the Drizzle table definitions.

import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as promotionsSchema from "../../../shared/v2/promotions/schema";
import * as appraisalsSchema from "../../../shared/v2/appraisals/schema";
import * as restHoursSchema from "../../../shared/v2/rest-hours/schema";
import * as vesselSchema from "../../../shared/v2/vessel/schema";
import * as adminSchema from "../../../shared/v2/admin/schema";

let registry: Map<string, Map<string, string>> | null = null;

function build(): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  for (const mod of [promotionsSchema, appraisalsSchema, restHoursSchema, vesselSchema, adminSchema] as Record<string, unknown>[]) {
    for (const value of Object.values(mod)) {
      if (!is(value, PgTable)) continue;
      const cols = new Map<string, string>();
      for (const [prop, col] of Object.entries(getTableColumns(value as PgTable))) cols.set(prop, (col as any).name);
      map.set(getTableName(value as PgTable), cols);
    }
  }
  return map;
}

const camelToSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function columnNameOf(table: string, key: string): string {
  registry ??= build();
  return registry.get(table)?.get(key) ?? camelToSnake(key);
}

// Schema lookups for the sync config consistency test.
export function schemaHasTable(table: string): boolean {
  registry ??= build();
  return registry.has(table);
}

export function schemaHasColumn(table: string, sqlColumn: string): boolean {
  registry ??= build();
  return [...(registry.get(table)?.values() ?? [])].includes(sqlColumn);
}
