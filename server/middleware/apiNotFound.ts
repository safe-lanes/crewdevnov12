import type { Request, Response } from "express";

/**
 * Terminal handler for unmatched /api paths (mounted after all API routers,
 * before the SPA catch-all). Without it, requests to mistyped, renamed, or
 * removed API endpoints fall through to the SPA fallback and "succeed" with
 * 200 + index.html — a silent failure mode that previously made a group of
 * legacy test suites fail in ways that took real effort to diagnose.
 */
export function apiNotFound(req: Request, res: Response): void {
  res.status(404).json({
    error: "Not found",
    method: req.method,
    path: req.originalUrl,
  });
}
