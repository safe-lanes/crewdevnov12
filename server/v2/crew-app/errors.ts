import { Response } from "express";

export type AppError = Error & { status: number; details?: unknown };

export function httpError(message: string, status: number, details?: unknown): AppError {
  return Object.assign(new Error(message), { status, details });
}

export function notFound(message: string): AppError {
  return httpError(message, 404);
}

/**
 * Shared error responder for crew-app controllers — checks error.status
 * first (set via httpError/notFound above), instead of the
 * `error?.message === "X not found"` string-equality checks previously
 * hand-copied into content/notices/notifications controllers. Callers still
 * handle ZodError separately beforehand, since that needs error.errors.
 */
export function sendCrewAppError(res: Response, error: any, fallbackMessage: string, logLabel: string): void {
  const status = typeof error?.status === "number" ? error.status : 500;
  if (status === 500) {
    console.error(`${logLabel}:`, error);
    res.status(500).json({ error: fallbackMessage });
    return;
  }
  res.status(status).json({ error: error.message, ...(error?.details ? { details: error.details } : {}) });
}
