import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  tenantConnectionManager,
  TenantNotFoundError,
  TenantInactiveError,
  TenantDatabaseError,
} from "../utils/tenantConnectionManager";
import { extractToken, JwtPayload } from "./authMiddleware";
import { isExempt } from "./exemptPaths";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      jwtDomain?: string;
    }
  }
}

type JwtDecodeResult =
  | { status: "ok"; decoded: JwtPayload; domain?: string }
  | { status: "no_token" }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "no_secret" };

type Branch = "header-path" | "jwt-fallback";

// Rate-limit verify-failure log lines so a refresh storm produces one entry,
// not fifty. Keyed by `path|errorName`. Cap entries to avoid unbounded growth.
const LOG_INTERVAL_MS = 30_000;
const LOG_MAP_CAP = 200;
const lastLoggedAt = new Map<string, number>();

function shouldLog(path: string, errorName: string): boolean {
  const key = `${path}|${errorName}`;
  const now = Date.now();
  const prev = lastLoggedAt.get(key);
  if (prev !== undefined && now - prev < LOG_INTERVAL_MS) return false;
  if (lastLoggedAt.size >= LOG_MAP_CAP && !lastLoggedAt.has(key)) {
    // Evict oldest entry (Map preserves insertion order).
    const oldestKey = lastLoggedAt.keys().next().value;
    if (oldestKey !== undefined) lastLoggedAt.delete(oldestKey);
  }
  lastLoggedAt.set(key, now);
  return true;
}

interface TokenDiagnostics {
  alg: string;
  kid: string;
  iss: string;
  sub: string;
  aud: string;
  domain: string;
  iat: string;
  exp: string;
  tokenLen: number;
  tail: string;
}

function isoOrDash(unixSec: unknown): string {
  if (typeof unixSec !== "number" || !Number.isFinite(unixSec)) return "-";
  try {
    return new Date(unixSec * 1000).toISOString();
  } catch {
    return "-";
  }
}

const TAIL_LEN = 6;
function tokenTail(token: string): string {
  // Always emit at most TAIL_LEN trailing chars so a short/garbage value
  // can never log the full thing.
  return token.length <= TAIL_LEN
    ? `...${"*".repeat(token.length)}`
    : `...${token.slice(-TAIL_LEN)}`;
}

function decodeForDiagnostics(token: string): TokenDiagnostics {
  const fallback: TokenDiagnostics = {
    alg: "-",
    kid: "-",
    iss: "-",
    sub: "-",
    aud: "-",
    domain: "-",
    iat: "-",
    exp: "-",
    tokenLen: token.length,
    tail: tokenTail(token),
  };
  try {
    const decoded = jwt.decode(token, { complete: true }) as
      | { header?: Record<string, unknown>; payload?: Record<string, unknown> }
      | null;
    if (!decoded) return fallback;
    const header = (decoded.header ?? {}) as Record<string, unknown>;
    const payload = (decoded.payload ?? {}) as Record<string, unknown>;
    const str = (v: unknown): string =>
      v === undefined || v === null || v === ""
        ? "-"
        : Array.isArray(v)
          ? v.map(String).join(",")
          : String(v);
    return {
      alg: str(header.alg),
      kid: str(header.kid),
      iss: str(payload.iss),
      sub: str(payload.sub ?? payload.id),
      aud: str(payload.aud),
      domain: str(payload.domain),
      iat: isoOrDash(payload.iat),
      exp: isoOrDash(payload.exp),
      tokenLen: token.length,
      tail: tokenTail(token),
    };
  } catch {
    return fallback;
  }
}

function logVerifyFailure(
  req: Request,
  branch: Branch,
  errorName: string,
  errorMessage: string,
  token: string,
): void {
  if (!shouldLog(req.path, errorName)) return;
  const d = decodeForDiagnostics(token);
  // eslint-disable-next-line no-console
  console.warn(
    `[auth] jwt verify failed path=${req.path} method=${req.method} ` +
      `branch=${branch} errorName=${errorName} ` +
      `errorMessage=${JSON.stringify(errorMessage)} ` +
      `alg=${d.alg} kid=${d.kid} iss=${d.iss} sub=${d.sub} aud=${d.aud} ` +
      `domain=${d.domain} iat=${d.iat} exp=${d.exp} ` +
      `now=${new Date().toISOString()} tokenLen=${d.tokenLen} tail=${d.tail}`,
  );
}

function decodeJwt(req: Request, branch: Branch): JwtDecodeResult {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) return { status: "no_secret" };

  const token = extractToken(req);
  if (!token) return { status: "no_token" };

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const domain =
      typeof decoded.domain === "string" ? decoded.domain.trim() : undefined;
    if (domain) decoded.domain = domain;
    return { status: "ok", decoded, domain };
  } catch (err: unknown) {
    const errorName =
      typeof err === "object" && err !== null && "name" in err
        ? String((err as { name: unknown }).name)
        : "Error";
    const errorMessage =
      typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
    logVerifyFailure(req, branch, errorName, errorMessage, token);
    if (errorName === "TokenExpiredError") {
      return { status: "expired" };
    }
    return { status: "invalid" };
  }
}

function rejectForJwtStatus(
  res: Response,
  status: "expired" | "invalid" | "no_token",
): void {
  if (status === "expired") {
    res.status(401).json({
      error: "token_expired",
      message: "Authorization token has expired",
    });
  } else if (status === "invalid") {
    res.status(401).json({
      error: "invalid_token",
      message: "Invalid authorization token",
    });
  } else {
    res.status(401).json({
      error: "unauthorized",
      message: "Missing authorization token",
    });
  }
}

export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!tenantConnectionManager.isMultiTenantEnabled) {
    next();
    return;
  }

  if (isExempt(req.path)) {
    next();
    return;
  }

  const rawTenantId = req.headers["x-tenant-id"];
  const tenantId =
    typeof rawTenantId === "string" ? rawTenantId.trim() : undefined;

  if (!tenantId) {
    // JWT-fallback path: derive tenant from the token's `domain` claim.
    const jwtResult = decodeJwt(req, "jwt-fallback");

    if (jwtResult.status === "expired" || jwtResult.status === "invalid") {
      rejectForJwtStatus(res, jwtResult.status);
      return;
    }

    if (jwtResult.status === "no_secret" || jwtResult.status === "no_token") {
      res.status(400).json({
        error: "Missing x-tenant-id header",
        message: "Tenant identification is required for all API requests",
      });
      return;
    }

    if (!jwtResult.domain) {
      res.status(400).json({
        error: "Missing x-tenant-id header",
        message: "Tenant identification is required for all API requests",
      });
      return;
    }

    req.tokenData = jwtResult.decoded;
    req.user = jwtResult.decoded;
    req.jwtDomain = jwtResult.domain;

    tenantConnectionManager
      .resolveTenant(jwtResult.domain)
      .then((tenant) => {
        req.tenantId = tenant.tuid;
        return tenantConnectionManager.runInTenantContext(
          tenant.tuid,
          () => {
            return new Promise<void>((resolve, reject) => {
              res.on("finish", resolve);
              res.on("error", reject);
              next();
            });
          },
        );
      })
      .catch((err) => {
        if (res.headersSent) return;
        handleTenantError(res, err);
      });
    return;
  }

  // Header path: x-tenant-id present. Validate the tenant AND decode the JWT
  // so `req.user` is populated for downstream routes — this gives production
  // the same "JWT verified exactly once per request" guarantee that dev gets
  // via the separate authMiddleware.
  const jwtResult = decodeJwt(req, "header-path");

  if (
    jwtResult.status === "expired" ||
    jwtResult.status === "invalid" ||
    jwtResult.status === "no_token"
  ) {
    // Uniform with the JWT-fallback branch: a non-exempt request must carry
    // a valid bearer token. Missing/expired/invalid all surface here as 401
    // from a single canonical verifier instead of as a router-local 401.
    rejectForJwtStatus(res, jwtResult.status);
    return;
  }

  // `no_secret` only occurs in dev when JWT_SECRET is not configured;
  // production boot in server/v2/auth/tokens.ts throws if it's missing.
  // Pass through and let route-level / dev AUTH_BYPASS guards decide.
  if (jwtResult.status === "ok") {
    req.tokenData = jwtResult.decoded;
    req.user = jwtResult.decoded;
    if (jwtResult.domain) req.jwtDomain = jwtResult.domain;
  }

  req.tenantId = tenantId;

  tenantConnectionManager
    .validateTuid(tenantId)
    .then(() => {
      return tenantConnectionManager.runInTenantContext(tenantId!, () => {
        return new Promise<void>((resolve, reject) => {
          res.on("finish", resolve);
          res.on("error", reject);
          next();
        });
      });
    })
    .catch((err) => {
      if (res.headersSent) return;
      handleTenantError(res, err);
    });
}

function handleTenantError(res: Response, err: unknown): void {
  if (err instanceof TenantNotFoundError) {
    res.status(403).json({
      error: "invalid_tenant",
      message: "The provided tenant identifier is not valid.",
    });
  } else if (err instanceof TenantInactiveError) {
    res.status(403).json({
      error: "tenant_inactive",
      message: err.message,
    });
  } else if (err instanceof TenantDatabaseError) {
    res.status(503).json({
      error: "Tenant database unavailable",
      message:
        "Unable to connect to the tenant database. Please try again later.",
    });
  } else {
    res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred during tenant resolution",
    });
  }
}
