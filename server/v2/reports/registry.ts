import type { ReportHandler } from "./types";

const REGISTRY = new Map<string, ReportHandler<unknown>>();

export function registerReport<T>(handler: ReportHandler<T>): void {
  if (REGISTRY.has(handler.reportId)) {
    throw new Error(`Report already registered: ${handler.reportId}`);
  }
  REGISTRY.set(handler.reportId, handler as ReportHandler<unknown>);
}

export function getReport(reportId: string): ReportHandler<unknown> | undefined {
  return REGISTRY.get(reportId);
}

export function listRegisteredReports(): string[] {
  return Array.from(REGISTRY.keys());
}
