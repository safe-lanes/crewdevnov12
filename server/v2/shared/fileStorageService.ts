import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

// Ensure the private storage directory is resolved relative to project root
const PRIVATE_ROOT = path.resolve(".private");

// Simple extension-to-mime map supporting mandatory and common types
const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

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

  // 4. Enforce length constraints
  // Maximum length of prefix + sanitized base + ext is 255.
  // We limit the base to 100 characters to leave plenty of room for epoch timestamp (13 chars) + random8 (8 chars) + delimiters.
  if (sanitizedBase.length > 100) {
    sanitizedBase = sanitizedBase.substring(0, 100);
  }

  return `${sanitizedBase}${ext}`;
}

/**
 * Writes raw buffer to private filesystem under .private/{domain}/{module}/{timestamp}_{random8}_{filename}
 */
export async function writeAttachment(
  domain: string,
  module: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  // Sanitize tenant domain and module name to prevent path traversal in directory structure
  const cleanDomain = domain.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const cleanModule = module.replace(/[^a-zA-Z0-9_\-]/g, "_");

  const sanitizedName = sanitizeFileName(fileName);
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString("hex"); // 8 characters
  const uniqueName = `${timestamp}_${randomSuffix}_${sanitizedName}`;

  // Establish full target directory path
  const targetDir = path.join(PRIVATE_ROOT, cleanDomain, cleanModule);
  await fs.mkdir(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, uniqueName);
  await fs.writeFile(targetPath, buffer);

  // Return relative path from PRIVATE_ROOT (e.g. "domain/module/uniqueName")
  return path.join(cleanDomain, cleanModule, uniqueName).replace(/\\/g, "/");
}

/**
 * Reads an attachment from disk by relative path. Prevents path traversal.
 */
export async function readAttachment(
  filePath: string
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
  // Resolve path and ensure it remains strictly inside PRIVATE_ROOT to block path traversal
  const resolvedPath = path.resolve(PRIVATE_ROOT, filePath);
  if (!resolvedPath.startsWith(PRIVATE_ROOT)) {
    throw new Error("Access Denied: Path traversal detected.");
  }

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

export const fileStorageService = {
  sanitizeFileName,
  writeAttachment,
  readAttachment,
};
