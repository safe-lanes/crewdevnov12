import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { tenantConnectionManager } from "../../utils/tenantConnectionManager.js";

// Ensure the private storage directory is resolved relative to project root
const PRIVATE_ROOT = path.resolve(".private");

// Standard §4: server-side ceiling of 5 MB on every stored attachment.
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// Simple extension-to-mime map supporting mandatory and common types
const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

// Standard §4: MIME-signature allow-list. Only these renderable types may be
// written to disk; the check is performed against the real file bytes (magic
// numbers) rather than the client-declared content-type.
const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

/**
 * Raised when an attachment fails server-side validation (size ceiling or
 * MIME-signature allow-list). Controllers should map this to an HTTP 400 so the
 * user sees a clear validation message instead of a generic 500.
 */
export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

/**
 * Detect the MIME type of a buffer from its leading magic bytes. Returns null
 * when the signature does not match a supported type.
 */
export function detectMimeBySignature(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

/**
 * Enforce the server-side size ceiling and MIME-signature allow-list on a
 * buffer before it is written to disk. Throws AttachmentValidationError when the
 * buffer is empty, exceeds 5 MB, or is not a permitted (PDF/PNG/JPEG) type.
 */
export function validateAttachmentBuffer(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) {
    throw new AttachmentValidationError("Attachment is empty.");
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError(
      `Attachment exceeds the ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB size limit.`,
    );
  }
  const detected = detectMimeBySignature(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected)) {
    throw new AttachmentValidationError(
      "Unsupported file type. Only PDF, PNG, and JPEG files are allowed.",
    );
  }
  return detected;
}

/**
 * Sanitizes a filename to prevent path traversal, special characters, and Windows reserved names.
 */
export function sanitizeFileName(name: string): string {
  // 1. Extract base name and extension
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext);

  // 2. Traversal & special character replacement
  // Replace path separators, spaces, and non-alphanumeric/non-ASCII characters with underscores
  let sanitizedBase = base
    .replace(/[\\/]/g, "_")                 // Path separators
    .replace(/\s+/g, "_")                    // Spaces
    .replace(/[^a-zA-Z0-9_\-]/g, "_")       // Special / Unicode characters
    .replace(/_+/g, "_");                    // Collapse multiple underscores

  // 3. Prevent Windows reserved names
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(sanitizedBase)) {
    sanitizedBase = `safe_${sanitizedBase}`;
  }

  // 4. Enforce length constraints (Standard §4: total filename <= 255; limit
  // the sanitized base to 200 to stay safe while leaving room for the
  // {timestamp}_{random8}_ prefix and extension.
  if (sanitizedBase.length > 200) {
    sanitizedBase = sanitizedBase.substring(0, 200);
  }

  return `${sanitizedBase}${ext}`;
}

/**
 * Resolve the tenant/domain folder name for attachment storage from the current
 * request context (AsyncLocalStorage), falling back to "main" when no tenant is
 * bound. Callers running inside a request no longer need to pass the domain;
 * out-of-request callers (e.g. the backfill script) may pass an explicit
 * override.
 */
function resolveDomain(domainOverride?: string): string {
  if (domainOverride && domainOverride.trim()) return domainOverride;
  return tenantConnectionManager.getCurrentDomain() || tenantConnectionManager.getCurrentTenantId() || "main";
}

/**
 * Writes raw buffer to private filesystem under
 * .private/{domain}/{group}/{entity}/{timestamp}_{random8}_{filename}.
 *
 * `module` may be a nested "group/entity" path so attachments are grouped by
 * their owning module on disk; each "/"-segment is sanitized independently.
 * Legacy callers passing a single flat segment continue to work unchanged.
 *
 * The tenant/domain is resolved internally from the request context; pass
 * `domainOverride` only from out-of-request contexts (e.g. backfill scripts).
 * The buffer is validated against the size ceiling and MIME-signature
 * allow-list before any bytes touch the disk.
 */
export async function writeAttachment(
  module: string,
  fileName: string,
  buffer: Buffer,
  domainOverride?: string,
): Promise<string> {
  // Server-side double-guard: size ceiling + MIME-signature allow-list.
  validateAttachmentBuffer(buffer);

  const domain = resolveDomain(domainOverride);

  // Sanitize tenant domain to prevent path traversal in directory structure
  const cleanDomain = domain.replace(/[^a-zA-Z0-9_\-]/g, "_");

  // The module identifier may be a nested "group/entity" path so attachments are
  // grouped by their owning module on disk (e.g. "crew-pool/crew-sea-service").
  // Split on "/", drop empty and traversal segments, then sanitize each segment
  // independently so a malicious value can never escape the module folder.
  const cleanModuleSegments = module
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .map((segment) => segment.replace(/[^a-zA-Z0-9_\-]/g, "_"))
    .filter((segment) => segment.length > 0);
  if (cleanModuleSegments.length === 0) {
    cleanModuleSegments.push("misc");
  }

  const sanitizedName = sanitizeFileName(fileName);
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString("hex"); // 8 characters
  const uniqueName = `${timestamp}_${randomSuffix}_${sanitizedName}`;

  // Establish full target directory path
  const targetDir = path.join(PRIVATE_ROOT, cleanDomain, ...cleanModuleSegments);
  await fs.mkdir(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, uniqueName);
  await fs.writeFile(targetPath, buffer);

  // Return relative path from PRIVATE_ROOT (e.g. "domain/group/entity/uniqueName")
  return path.join(cleanDomain, ...cleanModuleSegments, uniqueName).replace(/\\/g, "/");
}

/**
 * Resolve a stored relative path to an absolute path strictly inside
 * PRIVATE_ROOT. Throws on traversal. Segment-aware: a sibling directory whose
 * name merely shares the PRIVATE_ROOT prefix cannot pass a naive startsWith.
 */
function resolveInsidePrivateRoot(filePath: string): string {
  const resolvedPath = path.resolve(PRIVATE_ROOT, filePath);
  const relative = path.relative(PRIVATE_ROOT, resolvedPath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Access Denied: Path traversal detected.");
  }
  return resolvedPath;
}

/**
 * Reads an attachment from disk by relative path. Prevents path traversal.
 */
export async function readAttachment(
  filePath: string,
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
  // Resolve path and ensure it remains strictly inside PRIVATE_ROOT to block path traversal
  const resolvedPath = resolveInsidePrivateRoot(filePath);

  // Check if file exists
  try {
    await fs.access(resolvedPath);
  } catch {
    throw new Error("File not found");
  }

  const fileHandle = await fs.open(resolvedPath, "r");
  const stream = fileHandle.createReadStream();

  const ext = path.extname(resolvedPath).toLowerCase();
  const mimeType = MIME_MAP[ext] || "application/octet-stream";

  return { stream, mimeType };
}

/**
 * Permanently remove an attachment file from disk by relative path. Safe to call
 * when the file is already gone (missing files are ignored). Path traversal is
 * blocked the same way as reads.
 */
export async function deleteAttachment(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;
  let resolvedPath: string;
  try {
    resolvedPath = resolveInsidePrivateRoot(filePath);
  } catch (err) {
    console.error(`deleteAttachment refused traversal for path ${filePath}:`, err);
    return;
  }
  try {
    await fs.unlink(resolvedPath);
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      console.error(`deleteAttachment failed for path ${filePath}:`, err);
    }
  }
}

export const fileStorageService = {
  sanitizeFileName,
  writeAttachment,
  readAttachment,
  deleteAttachment,
  validateAttachmentBuffer,
  detectMimeBySignature,
  AttachmentValidationError,
  MAX_ATTACHMENT_BYTES,
};
