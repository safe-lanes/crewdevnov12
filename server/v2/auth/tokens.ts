import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";

function ensureSecret(envName: string): string {
  const v = process.env[envName];
  if (v && v.length > 0) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${envName} environment variable is required in production`);
  }
  // Dev fallback — random, not persisted across restarts. Distinct per env name.
  const random = crypto.randomBytes(48).toString("hex");
  // eslint-disable-next-line no-console
  console.warn(`[auth] ${envName} not set; using ephemeral random secret for development.`);
  return random;
}

const JWT_SECRET = ensureSecret("JWT_SECRET");
const JWT_REFRESH_SECRET = ensureSecret("JWT_REFRESH_SECRET");
if (JWT_REFRESH_SECRET === JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_REFRESH_SECRET must be different from JWT_SECRET");
  }
  // eslint-disable-next-line no-console
  console.warn("[auth] JWT_REFRESH_SECRET equals JWT_SECRET — refusing in production.");
}
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || "7d";
// Bcrypt cost: enforce a minimum of 12 rounds per task requirements.
// Operators may raise this via env, but never lower it below 12.
const MIN_BCRYPT_ROUNDS = 12;
const requestedRounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
export const BCRYPT_ROUNDS = Math.max(
  MIN_BCRYPT_ROUNDS,
  Number.isFinite(requestedRounds) ? requestedRounds : MIN_BCRYPT_ROUNDS,
);
if (requestedRounds < MIN_BCRYPT_ROUNDS) {
  // eslint-disable-next-line no-console
  console.warn(`[auth] BCRYPT_ROUNDS=${requestedRounds} below minimum; clamped to ${MIN_BCRYPT_ROUNDS}.`);
}
const CLOCK_SKEW_SEC = 5;

export interface AccessClaims {
  id: number;
  domain: string;
  userType: string;
  uuid?: string;
  username?: string;
  roleId?: string;
}

export interface RefreshClaims {
  id: number;
  domain: string;
  jti: string;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: ACCESS_TTL } as SignOptions);
}

export function signRefreshToken(claims: RefreshClaims): string {
  return jwt.sign(claims, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshClaims {
  return jwt.verify(token, JWT_REFRESH_SECRET, { clockTolerance: CLOCK_SKEW_SEC }) as RefreshClaims;
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, JWT_SECRET, { clockTolerance: CLOCK_SKEW_SEC }) as AccessClaims;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function refreshExpiryDate(): Date {
  const ttlMs = parseTtlMs(REFRESH_TTL);
  return new Date(Date.now() + ttlMs);
}

export function passwordResetExpiryDate(): Date {
  const ttlMs = parseTtlMs(process.env.PASSWORD_RESET_TTL || "1h");
  return new Date(Date.now() + ttlMs);
}

function parseTtlMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    default: return n * 1000;
  }
}
