import { z } from "zod";

export type ReportColumnType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "status";

export interface ReportColumn {
  key: string;
  label: string;
  type?: ReportColumnType;
  width?: number;
  align?: "left" | "right" | "center";
}

export interface ReportResultRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ReportRunRequest {
  reportId: string;
  filters: Record<string, unknown>;
  page: number;
  pageSize: number;
  sort?: { key: string; direction: "asc" | "desc" } | null;
}

export interface ReportRunResponse {
  reportId: string;
  title: string;
  columns: ReportColumn[];
  rows: ReportResultRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportHandlerContext {
  page: number;
  pageSize: number;
  sort: { key: string; direction: "asc" | "desc" } | null;
}

export interface ReportHandler<TFilters = unknown> {
  reportId: string;
  title: string;
  columns: ReportColumn[];
  filterSchema: z.ZodType<TFilters>;
  run: (
    filters: TFilters,
    ctx: ReportHandlerContext,
  ) => Promise<{ rows: ReportResultRow[]; total: number }>;
}

export const reportRunRequestSchema = z.object({
  reportId: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).default({}),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
  sort: z
    .object({
      key: z.string().min(1),
      direction: z.enum(["asc", "desc"]),
    })
    .nullable()
    .optional(),
});
