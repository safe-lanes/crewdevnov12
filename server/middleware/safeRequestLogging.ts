import { createHash, randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

const SAFE_REQUEST_ID = /^[a-zA-Z0-9._-]{8,128}$/;

declare global { namespace Express { interface Request { requestId?: string } } }

function pseudonym(value: unknown): string | undefined {
  return typeof value === "string" && value
    ? createHash("sha256").update(value).digest("hex").slice(0, 12)
    : undefined;
}

export function safeRoute(req: Request): string {
  return typeof req.route?.path === "string"
    ? `${req.baseUrl || ""}${req.route.path}` || "/"
    : req.path.startsWith("/api") ? "/api/<unmatched>" : "<unmatched>";
}

export function buildSafeRequestEvent(req: Request, res: Response, durationMs: number) {
  return {
    event: "http_request", requestId: req.requestId, timestamp: new Date().toISOString(),
    method: req.method, route: safeRoute(req), status: res.statusCode, durationMs,
    actorType: req.crewUser ? "crew" : req.user ? "erp_user" : "anonymous",
    tenant: pseudonym(req.crewUser?.domain ?? req.jwtDomain ?? req.tenantId),
    actor: pseudonym(req.crewUser?.crewUuid ?? (req.user?.id === undefined ? undefined : String(req.user.id))),
  };
}

export function safeRequestLogging(write: (line: string) => void = console.log) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const supplied = req.header("x-request-id");
    req.requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
    res.setHeader("X-Request-ID", req.requestId);
    const started = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) write(JSON.stringify(buildSafeRequestEvent(req, res, Date.now() - started)));
    });
    next();
  };
}
