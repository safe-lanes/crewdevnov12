import { Router, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { eq, and, sql, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { users, refreshTokens, passwordResetTokens, loginAuditLog } from "@shared/schema";
import { getDbForDomain, getCurrentDb } from "./db";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  hashRefreshToken,
  generateOpaqueToken,
  hashPassword,
  verifyPassword,
  refreshExpiryDate,
  passwordResetExpiryDate,
} from "./tokens";

/**
 * Ensures req.user is populated from the bearer access token, even when the
 * global AUTH_BYPASS flag is set (which skips the parent authMiddleware).
 */
function ensureAuthUser(req: Request, res: Response, next: () => void) {
  if (req.user) return next();
  const auth = req.headers["authorization"];
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "unauthorized", message: "Missing authorization token" });
  }
  const token = auth.slice(7).trim();
  try {
    req.user = verifyAccessToken(token) as any;
    return next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "token_expired", message: "Token has expired" });
    }
    return res.status(401).json({ error: "invalid_token", message: "Invalid authorization token" });
  }
}

const router = Router();

const MAX_FAILED = parseInt(process.env.AUTH_MAX_FAILED || "5", 10);
const LOCKOUT_MIN = parseInt(process.env.AUTH_LOCKOUT_MIN || "15", 10);

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const u = (req.body?.username || "").toLowerCase().trim();
    const d = (req.body?.domain || "").toLowerCase().trim();
    return `${ipKeyGenerator(req.ip || "")}|${u}|${d}`;
  },
  message: { error: "rate_limited", message: "Too many login attempts. Please try again later." },
});

const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many refresh attempts." },
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "")}|${(req.body?.email || "").toLowerCase().trim()}`,
  message: { error: "rate_limited", message: "Too many password reset requests." },
});

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf) return xf.split(",")[0].trim();
  return req.ip || "";
}

async function audit(
  db: ReturnType<typeof getCurrentDb>,
  args: {
    userId?: number | null;
    username?: string | null;
    domain?: string | null;
    event: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    detail?: string;
  },
) {
  try {
    await db.insert(loginAuditLog).values({
      userId: args.userId ?? null,
      username: args.username ?? null,
      domain: args.domain ?? null,
      event: args.event,
      success: args.success,
      ipAddress: args.ipAddress ?? null,
      userAgent: args.userAgent ?? null,
      detail: args.detail ?? null,
    });
  } catch (err) {
    console.error("[auth] audit log failed:", (err as Error).message);
  }
}

const loginSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
  domain: z.string().trim().min(1).max(128),
});

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", message: "username, password, and domain are required" });
  }
  const { username, password, domain } = parsed.data;
  const ip = clientIp(req);
  const ua = (req.headers["user-agent"] as string) || "";

  // Generic response used for ALL failure modes to prevent enumeration
  // (unknown domain, unknown user, bad password, inactive, locked).
  // The specific reason is recorded in the audit log for operators.
  const GENERIC_FAIL = {
    status: 401,
    body: { error: "invalid_credentials", message: "Invalid username, password, or domain." },
  } as const;

  let db;
  let tuid: string | null = null;
  try {
    const r = await getDbForDomain(domain);
    db = r.db;
    tuid = r.tuid;
  } catch (err: any) {
    // Use a single (any) tenant DB for audit if available; otherwise skip the log.
    console.warn("[auth] login: domain not found:", domain);
    return res.status(GENERIC_FAIL.status).json(GENERIC_FAIL.body);
  }

  const found = await db
    .select()
    .from(users)
    .where(and(sql`LOWER(${users.username}) = LOWER(${username})`, eq(users.domain, domain)))
    .limit(1);

  if (found.length === 0) {
    await audit(db, { username, domain, event: "login", success: false, ipAddress: ip, userAgent: ua, detail: "user_not_found" });
    return res.status(GENERIC_FAIL.status).json(GENERIC_FAIL.body);
  }

  const user = found[0];

  if (!user.isActive) {
    await audit(db, { userId: user.id, username, domain, event: "login", success: false, ipAddress: ip, userAgent: ua, detail: "inactive" });
    return res.status(GENERIC_FAIL.status).json(GENERIC_FAIL.body);
  }

  if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
    await audit(db, { userId: user.id, username, domain, event: "login", success: false, ipAddress: ip, userAgent: ua, detail: "locked" });
    return res.status(GENERIC_FAIL.status).json(GENERIC_FAIL.body);
  }

  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    const newFails = (user.failedLoginAttempts || 0) + 1;
    const shouldLock = newFails >= MAX_FAILED;
    const lockUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MIN * 60 * 1000) : null;
    await db
      .update(users)
      .set({
        failedLoginAttempts: newFails,
        lockoutUntil: lockUntil,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    await audit(db, { userId: user.id, username, domain, event: "login", success: false, ipAddress: ip, userAgent: ua, detail: shouldLock ? `bad_password+lock` : `bad_password` });
    return res.status(GENERIC_FAIL.status).json(GENERIC_FAIL.body);
  }

  // Success — reset counters, update lastLogin
  let userUuid = user.uuid;
  if (!userUuid) {
    userUuid = randomUUID();
    await db.update(users).set({ uuid: userUuid }).where(eq(users.id, user.id));
  }
  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      tenantId: tuid ?? user.tenantId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  const accessToken = signAccessToken({
    id: user.id,
    domain,
    userType: user.userType || "user",
    uuid: userUuid,
    username: user.username,
    roleId: user.roleId || undefined,
  });
  const jti = generateOpaqueToken(16);
  const refreshToken = signRefreshToken({ id: user.id, domain, jti });
  const expiresAt = refreshExpiryDate();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    ipAddress: ip,
    userAgent: ua.slice(0, 256),
    expiresAt,
  });

  await audit(db, { userId: user.id, username, domain, event: "login", success: true, ipAddress: ip, userAgent: ua });

  return res.json({
    accessToken,
    refreshToken,
    tenantId: tuid,
    user: {
      id: user.id,
      uuid: userUuid,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      designation: user.designation,
      userType: user.userType,
      roleId: user.roleId,
      domain,
    },
  });
});

router.post("/refresh", refreshLimiter, async (req: Request, res: Response) => {
  const token = (req.body?.refreshToken as string) || "";
  if (!token) {
    return res.status(400).json({ error: "invalid_request", message: "refreshToken is required" });
  }

  let claims;
  try {
    claims = verifyRefreshToken(token);
  } catch (err: any) {
    return res.status(401).json({ error: "invalid_refresh", message: "Invalid or expired refresh token" });
  }

  let db;
  let tuid: string | null = null;
  try {
    const r = await getDbForDomain(claims.domain);
    db = r.db;
    tuid = r.tuid;
  } catch {
    return res.status(401).json({ error: "invalid_refresh", message: "Invalid refresh token" });
  }

  const tokenHash = hashRefreshToken(token);
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (rows.length === 0) {
    return res.status(401).json({ error: "invalid_refresh", message: "Refresh token not recognized" });
  }
  const stored = rows[0];

  if (stored.revokedAt) {
    // Reuse detected — revoke entire chain for this user
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: "reuse_detected" })
      .where(and(eq(refreshTokens.userId, stored.userId), isNull(refreshTokens.revokedAt)));
    await audit(db, {
      userId: stored.userId,
      domain: claims.domain,
      event: "refresh_reuse",
      success: false,
      ipAddress: clientIp(req),
      detail: "all_tokens_revoked",
    });
    return res.status(401).json({ error: "invalid_refresh", message: "Refresh token reuse detected" });
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ error: "invalid_refresh", message: "Refresh token expired" });
  }

  const userRows = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (userRows.length === 0 || !userRows[0].isActive) {
    return res.status(401).json({ error: "invalid_refresh", message: "User no longer active" });
  }
  const user = userRows[0];

  // Rotate
  const ip = clientIp(req);
  const ua = (req.headers["user-agent"] as string) || "";
  const newJti = generateOpaqueToken(16);
  const newRefresh = signRefreshToken({ id: user.id, domain: claims.domain, jti: newJti });
  const newAccess = signAccessToken({
    id: user.id,
    domain: claims.domain,
    userType: user.userType || "user",
    uuid: user.uuid || undefined,
    username: user.username,
    roleId: user.roleId || undefined,
  });

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), revokedReason: "rotated" })
    .where(eq(refreshTokens.id, stored.id));
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(newRefresh),
    parentId: stored.id,
    ipAddress: ip,
    userAgent: ua.slice(0, 256),
    expiresAt: refreshExpiryDate(),
  });

  await audit(db, { userId: user.id, domain: claims.domain, event: "refresh", success: true, ipAddress: ip, userAgent: ua });

  return res.json({
    accessToken: newAccess,
    refreshToken: newRefresh,
    tenantId: tuid,
  });
});

router.post("/logout", async (req: Request, res: Response) => {
  const auth = req.headers["authorization"];
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    try {
      req.user = verifyAccessToken(auth.slice(7).trim()) as any;
    } catch { /* ignore: logout always succeeds */ }
  }
  return logoutHandler(req, res);
});

async function logoutHandler(req: Request, res: Response) {
  const refreshToken = (req.body?.refreshToken as string) || "";
  const user = req.user;
  if (!refreshToken && !user) {
    return res.json({ ok: true });
  }
  try {
    const db = getCurrentDb();
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), revokedReason: "logout" })
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
    }
    if (user?.id) {
      await audit(db, { userId: user.id, domain: user.domain, event: "logout", success: true, ipAddress: clientIp(req) });
    }
  } catch (err) {
    console.error("[auth] logout error:", (err as Error).message);
  }
  return res.json({ ok: true });
}

router.get("/profile", ensureAuthUser, async (req: Request, res: Response) => {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "unauthorized" });
  try {
    const db = getCurrentDb();
    const rows = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: "not_found" });
    const user = rows[0];
    return res.json({
      id: user.id,
      uuid: user.uuid,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      designation: user.designation,
      userType: user.userType,
      roleId: user.roleId,
      domain: user.domain,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: (err as Error).message });
  }
});

const changePwSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

router.post("/change-password", ensureAuthUser, async (req: Request, res: Response) => {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "unauthorized" });
  const parsed = changePwSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", message: "currentPassword and newPassword (min 8 chars) are required" });
  }
  const db = getCurrentDb();
  const rows = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: "not_found" });
  const user = rows[0];
  const ok = await verifyPassword(parsed.data.currentPassword, user.password);
  if (!ok) {
    await audit(db, { userId: user.id, username: user.username, domain: user.domain, event: "change_password", success: false, ipAddress: clientIp(req), detail: "wrong_current" });
    return res.status(401).json({ error: "invalid_credentials", message: "Current password is incorrect." });
  }
  const newHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(users)
    .set({ password: newHash, passwordChangedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  // Revoke all refresh tokens for this user
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), revokedReason: "password_changed" })
    .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
  await audit(db, { userId: user.id, username: user.username, domain: user.domain, event: "change_password", success: true, ipAddress: clientIp(req) });
  return res.json({ ok: true });
});

const forgotSchema = z.object({
  email: z.string().email().max(256),
  domain: z.string().trim().min(1).max(128),
});

router.post("/forgot-password", forgotLimiter, async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    // Always return generic success to avoid enumeration
    return res.json({ ok: true });
  }
  const { email, domain } = parsed.data;
  let db;
  try {
    const r = await getDbForDomain(domain);
    db = r.db;
  } catch {
    return res.json({ ok: true });
  }
  const rows = await db
    .select()
    .from(users)
    .where(and(sql`LOWER(${users.email}) = LOWER(${email})`, eq(users.domain, domain), eq(users.isActive, true)))
    .limit(1);

  if (rows.length === 0) {
    return res.json({ ok: true });
  }
  const user = rows[0];
  const rawToken = generateOpaqueToken(32);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(rawToken),
    expiresAt: passwordResetExpiryDate(),
    ipAddress: clientIp(req),
  });
  await audit(db, { userId: user.id, username: user.username, domain, event: "forgot_password", success: true, ipAddress: clientIp(req) });

  // In dev expose the token for manual testing; in prod this would be emailed.
  const payload: Record<string, unknown> = { ok: true };
  if (process.env.NODE_ENV !== "production") {
    payload.devResetToken = rawToken;
  }
  return res.json(payload);
});

const resetSchema = z.object({
  token: z.string().min(8).max(256),
  domain: z.string().trim().min(1).max(128),
  newPassword: z.string().min(8).max(256),
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", message: "token, domain, and newPassword (min 8 chars) are required" });
  }
  const { token, domain, newPassword } = parsed.data;
  let db;
  try {
    const r = await getDbForDomain(domain);
    db = r.db;
  } catch {
    return res.status(401).json({ error: "invalid_token", message: "Invalid or expired reset token" });
  }
  const tokenHash = hashRefreshToken(token);
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  if (rows.length === 0) {
    return res.status(401).json({ error: "invalid_token", message: "Invalid or expired reset token" });
  }
  const rec = rows[0];
  if (rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ error: "invalid_token", message: "Invalid or expired reset token" });
  }
  const newHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({
      password: newHash,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockoutUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, rec.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, rec.id));
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), revokedReason: "password_reset" })
    .where(and(eq(refreshTokens.userId, rec.userId), isNull(refreshTokens.revokedAt)));
  await audit(db, { userId: rec.userId, domain, event: "reset_password", success: true, ipAddress: clientIp(req) });
  return res.json({ ok: true });
});

export default router;
