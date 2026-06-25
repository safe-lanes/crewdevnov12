import { Response } from "express";
import { fileStorageService } from "./fileStorageService";
import { Readable } from "stream";

// MIME types that are safe to render inline in the browser.
// Others (like text/html, image/svg+xml) must download to prevent cross-site scripting (XSS).
const INLINE_RENDERABLE_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

/**
 * Decode a stored base64 attachment value into raw bytes + mime type.
 */
export function decodeStoredFile(
  stored: string | null | undefined,
  fallbackType?: string | null,
  allowRawBase64 = false
): { buffer: Buffer; mime: string } | null {
  if (!stored) return null;

  if (stored.startsWith("data:")) {
    const match = stored.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
    if (!match) return null;
    const mime = match[1] || fallbackType || "application/octet-stream";
    const isBase64 = !!match[2];
    const payload = match[3];
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf-8");
    return { buffer, mime };
  }

  // Out-of-request callers (e.g. the backfill script) may hold legacy values
  // stored as bare base64 without the data-URL scheme. Only attempt this when
  // explicitly opted in, so request-time serving stays strict.
  if (allowRawBase64) {
    try {
      const buffer = Buffer.from(stored, "base64");
      if (buffer.length === 0) return null;
      return { buffer, mime: fallbackType || "application/octet-stream" };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Shared helper to serve files to Express response.
 * Implements security headers and handles the dual-read fallback.
 * 
 * @param res Express Response
 * @param attachment The database attachment record
 */
export async function serveAttachmentFromFilePath(
  res: Response,
  attachment: {
    filePath: string | null;
    fileData: string | null;
    fileName: string | null;
    fileType: string | null;
  }
): Promise<void> {
  const { filePath, fileData, fileName, fileType } = attachment;

  // Set absolute baseline security headers
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  const cleanName = fileName || "attachment";

  // Case 1: Dual-read - filePath exists on filesystem
  if (filePath) {
    try {
      const { stream, mimeType } = await fileStorageService.readAttachment(filePath);
      
      const inline = INLINE_RENDERABLE_MIMES.has(mimeType);
      const contentDisposition = inline
        ? `inline; filename="${encodeURIComponent(cleanName)}"`
        : `attachment; filename="${encodeURIComponent(cleanName)}"`;

      res.set("Content-Type", mimeType);
      res.set("Content-Disposition", contentDisposition);
      
      stream.pipe(res);
      return;
    } catch (err: any) {
      console.error(`serveAttachmentFromFilePath filesystem read error for path ${filePath}:`, err);
      // If file not found on disk, we can try to fall back to fileData if available,
      // otherwise return 404.
      if (!fileData) {
        res.status(404).json({ error: "Attachment file not found on server disk" });
        return;
      }
    }
  }

  // Case 2: Fallback - decode base64 fileData
  if (fileData) {
    const decoded = decodeStoredFile(fileData, fileType);
    if (!decoded) {
      res.status(400).json({ error: "Failed to decode base64 attachment data" });
      return;
    }

    const { buffer, mime } = decoded;
    const inline = INLINE_RENDERABLE_MIMES.has(mime);
    const contentDisposition = inline
      ? `inline; filename="${encodeURIComponent(cleanName)}"`
      : `attachment; filename="${encodeURIComponent(cleanName)}"`;

    res.set("Content-Type", mime);
    res.set("Content-Disposition", contentDisposition);
    res.send(buffer);
    return;
  }

  // Case 3: Empty attachment
  res.status(404).json({ error: "No attachment content available" });
}
