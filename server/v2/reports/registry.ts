import type { ReportHandler } from "./types";

const REGISTRY = new Map<string, ReportHandler<any>>();

export function registerReport(handler: ReportHandler<any>): void {
  if (REGISTRY.has(handler.reportId)) {
    throw new Error(`Report already registered: ${handler.reportId}`);
  }
  REGISTRY.set(handler.reportId, handler);
}

export function getReport(reportId: string): ReportHandler<any> | undefined {
  return REGISTRY.get(reportId);
}

export function listRegisteredReports(): string[] {
  return Array.from(REGISTRY.keys());
}
