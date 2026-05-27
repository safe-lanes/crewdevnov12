import type { z } from "zod";
import type {
  ReportColumn,
  ReportResultRow,
  ReportSort,
} from "../../../shared/v2/reports/types";

export interface ReportHandlerContext {
  page: number;
  pageSize: number;
  sort: ReportSort | null;
}

export interface ReportHandlerResult {
  rows: ReportResultRow[];
  total: number;
}

export interface ReportHandler<TFilters> {
  reportId: string;
  title: string;
  columns: ReportColumn[];
  // Loosened input/def variance so handlers can use `.coerce`, `.default`,
  // `.transform`, etc. Filters always arrive as `unknown` from the request body.
  filterSchema: z.ZodType<TFilters, z.ZodTypeDef, unknown>;
  run: (
    filters: TFilters,
    ctx: ReportHandlerContext,
  ) => Promise<ReportHandlerResult>;
}
