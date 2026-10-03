import { z } from "zod";

const duration = z.string().regex(/^\d+(s|m|h|d)$/, "must be a duration such as 15m or 1h");
const secret = z.string().min(32, "must contain at least 32 characters").refine(v => !/replace_with|change_me|example|secret/i.test(v), "contains a placeholder");
const workerBoolean = z.enum(["true", "false"]).default("false");
const workerInteger = (min: number, max: number, fallback: string) => z.string().regex(/^\d+$/).default(fallback).transform(Number).pipe(z.number().int().min(min).max(max));
const schema = z.object({
  NODE_ENV: z.literal("production"), JWT_SECRET: secret,
  CREW_APP_ACCESS_TOKEN_SECRET: secret, CREW_APP_REFRESH_TOKEN_SECRET: secret,
  CREW_APP_ACCESS_TOKEN_TTL: duration.default("15m"),
  CREW_APP_ALLOWED_ORIGINS: z.string().min(1),
  CREW_APP_TENANCY_MODE: z.enum(["single", "multi"]),
  DATABASE_URL: z.string().optional(), MASTER_DATABASE_URL: z.string().optional(),
  CREW_APP_SINGLE_TENANT_DOMAIN: z.string().optional(),
  CREW_APP_FILE_SCANNER: z.literal("clamav"), CLAMAV_HOST: z.string().min(1),
  ATTACHMENT_STORAGE_DRIVER: z.literal("s3"), ATTACHMENT_S3_BUCKET: z.string().min(3),
  ATTACHMENT_S3_REGION: z.string().min(1), ATTACHMENT_S3_KMS_KEY_ID: z.string().min(1).optional(),
  ATTACHMENT_S3_ENDPOINT: z.string().url().startsWith("https://").optional(),
  ATTACHMENT_S3_ACCESS_KEY_ID: z.string().min(8).optional(), ATTACHMENT_S3_SECRET_ACCESS_KEY: z.string().min(16).optional(),
  CREW_APP_SIEM_URL: z.string().url().startsWith("https://"), CREW_APP_SIEM_TOKEN: secret,
  CREW_APP_SECURITY_EVENT_KEY: secret,
  CREW_APP_MFA_ENCRYPTION_KEY: z.string().refine(v => /^[0-9a-f]{64}$/i.test(v) || /^[A-Za-z0-9+/]{43}=$/.test(v), "must be a 32-byte key encoded as 64 hex characters or base64"),
  ERP_COMMAND_WORKER_ENABLED: workerBoolean,
  ERP_COMMAND_WORKER_POLL_INTERVAL_MS: workerInteger(250, 300_000, "5000"),
  ERP_COMMAND_WORKER_BATCH_SIZE: workerInteger(1, 100, "10"),
  ERP_COMMAND_WORKER_CONCURRENCY: workerInteger(1, 8, "2"),
  ERP_COMMAND_LEASE_SECONDS: workerInteger(10, 3600, "60"),
  ERP_COMMAND_MAX_ATTEMPTS: workerInteger(1, 20, "5"),
}).passthrough();

export function validateProductionConfig(env: NodeJS.ProcessEnv): void {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid production configuration: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const c = parsed.data;
  if (new Set([c.JWT_SECRET, c.CREW_APP_ACCESS_TOKEN_SECRET, c.CREW_APP_REFRESH_TOKEN_SECRET, c.CREW_APP_SECURITY_EVENT_KEY, c.CREW_APP_SIEM_TOKEN, c.CREW_APP_MFA_ENCRYPTION_KEY]).size !== 6) throw new Error("Invalid production configuration: JWT, MFA, security-event, and SIEM secrets must be distinct");
  const origins = c.CREW_APP_ALLOWED_ORIGINS.split(",").map(x => x.trim());
  if (origins.some(x => x === "*" || !x.startsWith("https://") || /localhost|127\.0\.0\.1|replace_with/i.test(x))) throw new Error("Invalid production configuration: crew app origins must be explicit production HTTPS origins");
  if (c.CREW_APP_TENANCY_MODE === "multi" && !c.MASTER_DATABASE_URL) throw new Error("Invalid production configuration: MASTER_DATABASE_URL is required for multi tenancy");
  if (c.CREW_APP_TENANCY_MODE === "single" && (!c.DATABASE_URL || !c.CREW_APP_SINGLE_TENANT_DOMAIN)) throw new Error("Invalid production configuration: single tenancy requires DATABASE_URL and CREW_APP_SINGLE_TENANT_DOMAIN");
  if (Boolean(c.ATTACHMENT_S3_ACCESS_KEY_ID) !== Boolean(c.ATTACHMENT_S3_SECRET_ACCESS_KEY)) throw new Error("Invalid production configuration: S3 access key and secret must be supplied together");
}

export interface ErpWorkerConfig {
  enabled: boolean; pollIntervalMs: number; batchSize: number; concurrency: number;
  leaseSeconds: number; maxAttempts: number;
}

export function getErpWorkerConfig(env: NodeJS.ProcessEnv = process.env): ErpWorkerConfig {
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const raw = env[name];
    if (raw === undefined && env.NODE_ENV !== "production") return fallback;
    if (!/^\d+$/.test(raw ?? "")) throw new Error(`${name} must be an integer`);
    const value = Number(raw);
    if (value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
    return value;
  };
  const enabledRaw = env.ERP_COMMAND_WORKER_ENABLED ?? (env.NODE_ENV === "production" ? undefined : "false");
  if (enabledRaw !== "true" && enabledRaw !== "false") throw new Error("ERP_COMMAND_WORKER_ENABLED must be true or false");
  return {
    enabled: enabledRaw === "true",
    pollIntervalMs: integer("ERP_COMMAND_WORKER_POLL_INTERVAL_MS", 5000, 250, 300_000),
    batchSize: integer("ERP_COMMAND_WORKER_BATCH_SIZE", 10, 1, 100),
    concurrency: integer("ERP_COMMAND_WORKER_CONCURRENCY", 2, 1, 8),
    leaseSeconds: integer("ERP_COMMAND_LEASE_SECONDS", 60, 10, 3600),
    maxAttempts: integer("ERP_COMMAND_MAX_ATTEMPTS", 5, 1, 20),
  };
}

export function validateProductionConfigAtStartup(): void {
  if (process.env.NODE_ENV === "production") validateProductionConfig(process.env);
}
