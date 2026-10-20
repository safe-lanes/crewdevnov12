import type { RequestHandler, Response } from "express";
import { AttachmentAccessError } from "./attachmentAccess";

/**
 * Never deliver stored file bytes/paths through a secondary JSON route.
 * Canonical viewUrl/raw routes enforce parent access before serving bytes.
 * Handles old JSON-encoded attachment arrays as well as normal nested arrays.
 */
export function redactAttachmentData(value: any): any {
  if (Array.isArray(value)) return value.filter(v => v?.isDeleted !== true && v?.is_deleted !== true).map(redactAttachmentData);
  if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (["fileData", "file_data", "filePath", "file_path"].includes(key)) return [];
    if (key === "data" && typeof item === "string" && item.startsWith("data:")) return [];
    if (["attachmentFile", "deprecatedAttachmentsData"].includes(key) && typeof item === "string") {
      try { return [[key, JSON.stringify(redactAttachmentData(JSON.parse(item)))]]; }
      catch { return [[key, null]]; }
    }
    return [[key, redactAttachmentData(item)]];
  }));
}

export const redactAttachmentJson: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD"].includes(req.method)) {
    const send = res.json.bind(res);
    res.json = body => send(redactAttachmentData(body));
  }
  next();
};

/** Protect attachment-bearing aggregate responses without trusting query filters. */
export function scopeAttachmentJson(res: Response, check: (row: any) => Promise<void>) {
  const send = res.json.bind(res);
  res.json = body => {
    if (res.statusCode >= 400) return send(body);
    void (async () => {
      if (Array.isArray(body)) {
        const filtered = [];
        for (const row of body) {
          try { await check(row); filtered.push(row); }
          catch (error) { if (!(error instanceof AttachmentAccessError)) throw error; }
        }
        send(filtered);
      } else if (body && Array.isArray(body.data)) {
        const filtered = [];
        for (const row of body.data) {
          try { await check(row); filtered.push(row); }
          catch (error) { if (!(error instanceof AttachmentAccessError)) throw error; }
        }
        send({ ...body, data: filtered, pagination: body.pagination ? {
          ...body.pagination, total: filtered.length, pages: filtered.length ? 1 : 0,
        } : undefined });
      } else {
        await check(body);
        send(body);
      }
    })().catch(error => {
      if (!(error instanceof AttachmentAccessError)) console.error("[AttachmentAccess] JSON scope failed", error);
      res.status(error instanceof AttachmentAccessError ? error.status : 403);
      send({ message: "This record is unavailable or you do not have permission to open it. Ask your administrator to check your access." });
    });
    return res;
  };
}
