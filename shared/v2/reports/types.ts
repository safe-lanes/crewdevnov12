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
  sortable?: boolean;
}

export type ReportCellValue = string | number | boolean | null;

export type ReportResultRow = Record<string, ReportCellValue>;

export interface ReportSort {
  key: string;
  direction: "asc" | "desc";
}

export interface ReportRunRequest {
  reportId: string;
  filters: Record<string, unknown>;
  page: number;
  pageSize: number;
  sort?: ReportSort | null;
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

export const reportSortSchema = z.object({
  key: z.string().min(1),
  direction: z.enum(["asc", "desc"]),
});

export const reportRunRequestSchema = z.object({
  reportId: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).default({}),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
  sort: reportSortSchema.nullable().optional(),
});
