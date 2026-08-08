import { Request, Response, NextFunction } from "express";
import multer from "multer";

/**
 * Maximum file size for import uploads.
 * Configurable via MAX_IMPORT_BYTES env var; defaults to 200 MB.
 * Exported so the controller can reuse the same limit in the stream path.
 */
export const MAX_IMPORT_BYTES = parseInt(
  process.env.MAX_IMPORT_BYTES || String(200 * 1024 * 1024),
  10,
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES },
});

/**
 * Per-route multer middleware for the four import endpoints.
 * Expects a single file under the field name "file".
 *
 * Maps multer's LIMIT_FILE_SIZE to a 413 JSON response before any
 * controller code runs. Other multer errors surface as 400.
 * Leaves every other route (planning attachments, etc.) completely
 * unaffected — this middleware is applied per-route, not globally.
 */
export function importUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: `File too large. Maximum allowed size is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.`,
        });
        return;
      }
      res.status(400).json({ error: err.message || "File upload error" });
      return;
    }
    next();
  });
}
