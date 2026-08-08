import { Request, Response } from "express";
import {
  parseCrewListZip,
  generateVesselImportWorkbook,
  importVesselRankHierarchy,
  importCrewAssignments,
} from "../services";
import { MAX_IMPORT_BYTES } from "../middleware/importUpload";

// ── Size-limit error for the raw-stream fallback path ────────────────────────

class StreamSizeLimitError extends Error {
  constructor() {
    super(
      `File exceeds the ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB size limit`,
    );
    this.name = "StreamSizeLimitError";
  }
}

// ── Request buffer resolver ──────────────────────────────────────────────────
// Priority order:
//   1. multer (multipart/form-data, field "file")  ← preferred path
//   2. base64-JSON legacy  { fileData: "<base64>" }
//   3. express.raw Buffer body
//   4. raw stream (bytes counted; throws StreamSizeLimitError on breach)

async function getBufferFromReq(
  req: Request & { file?: Express.Multer.File },
): Promise<Buffer | null> {
  // 1. Multer — multipart upload
  if (req.file?.buffer && req.file.buffer.length > 0) {
    return req.file.buffer;
  }

  // 2. Base64-JSON legacy (existing callers, zero regression)
  if (req.body && typeof req.body.fileData === "string" && req.body.fileData.length > 0) {
    return Buffer.from(req.body.fileData, "base64");
  }

  // 3. express.raw Buffer body (octet-stream callers)
  if (req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
    return req.body;
  }

  // 4. Raw stream — count bytes; drain + throw on breach
  return new Promise<Buffer | null>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on("data", (chunk: unknown) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any);
      totalBytes += buf.length;
      if (totalBytes > MAX_IMPORT_BYTES) {
        req.resume(); // drain the connection so the socket closes cleanly
        reject(new StreamSizeLimitError());
        return;
      }
      chunks.push(buf);
    });

    req.on("end", () =>
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : null),
    );
    req.on("error", () => resolve(null));
  });
}

// ── 413 helper — checked in every controller catch block ────────────────────

function handle413(error: unknown, res: Response): boolean {
  if (
    error instanceof StreamSizeLimitError ||
    (error as any)?.code === "LIMIT_FILE_SIZE"
  ) {
    res.status(413).json({
      error:
        (error as Error).message ||
        `File too large. Maximum allowed size is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.`,
    });
    return true;
  }
  return false;
}

// ── Controller ───────────────────────────────────────────────────────────────

export const vesselImportController = {
  /**
   * Parse a ZIP file of vessel crew lists (.docx) and return preview summary.
   * Accepts multipart (field "file"), base64-JSON, or raw binary.
   */
  async parseZip(req: Request, res: Response) {
    try {
      const buffer = await getBufferFromReq(req as any);
      if (!buffer) {
        return res.status(400).json({
          error: "No ZIP file provided",
          message:
            'Upload via multipart/form-data (field: "file"), or provide base64 "fileData" in JSON body.',
        });
      }

      const docs = await parseCrewListZip(buffer);
      const totalCrew = docs.reduce(
        (acc, d) => acc + (d.entries?.length || 0),
        0,
      );

      res.json({
        totalVessels: docs.length,
        totalCrewEntries: totalCrew,
        docs: docs.map((d) => ({
          fileName: d.fileName,
          vesselName: d.vesselName,
          imo: d.imo,
          crewCount: d.entries?.length || 0,
          errors: d.errors,
        })),
      });
    } catch (error: any) {
      if (handle413(error, res)) return;
      console.error("[VESSEL IMPORT] Error parsing ZIP:", error);
      res.status(500).json({ error: "Failed to parse crew list ZIP archive" });
    }
  },

  /**
   * Ingest ZIP archive of .docx crew lists and generate downloadable 2-sheet Excel workbook.
   * Accepts multipart (field "file"), base64-JSON, or raw binary.
   *
   * Template mode: when the JSON body contains `fileData: ""` (empty string) — i.e. the
   * "Download Template" button — no ZIP is required.  The workbook is generated with no
   * crew rows but with all dropdown lists populated from the DB (ports, ranks, etc.).
   * This path skips `getBufferFromReq` entirely so the empty-string value never reaches
   * the raw-stream fallback and no buffer-size or zip-parse errors can occur.
   */
  async generateWorkbook(req: Request, res: Response) {
    try {
      // ── Template-download shortcut ──────────────────────────────────────────
      // Client sends { fileData: "" } when the user clicks "Download Template"
      // (no ZIP to parse).  Generate the workbook with empty docs so headers
      // and dropdown lists are still present, but no crew rows are pre-filled.
      const isTemplateMode =
        req.body &&
        typeof req.body.fileData === "string" &&
        req.body.fileData.trim() === "";

      let docs: Awaited<ReturnType<typeof parseCrewListZip>> = [];

      if (!isTemplateMode) {
        const buffer = await getBufferFromReq(req as any);
        if (!buffer) {
          return res.status(400).json({
            error: "No ZIP file provided",
            message:
              'Upload via multipart/form-data (field: "file"), or provide base64 "fileData" in JSON body.',
          });
        }
        docs = await parseCrewListZip(buffer);
      }

      const result = await generateVesselImportWorkbook(docs);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=vessel_crew_import.xlsx",
      );
      res.send(result.buffer);
    } catch (error: any) {
      if (handle413(error, res)) return;
      console.error("[VESSEL IMPORT] Error generating workbook:", error);
      res
        .status(500)
        .json({ error: "Failed to generate vessel import workbook" });
    }
  },

  /**
   * Stage 1: Import VesselRankHierarchy sheet from uploaded .xlsx.
   * Accepts multipart (field "file"), base64-JSON, or raw binary.
   */
  async importHierarchy(req: Request, res: Response) {
    try {
      const buffer = await getBufferFromReq(req as any);
      if (!buffer) {
        return res.status(400).json({
          error: "No Excel file provided",
          message:
            'Upload via multipart/form-data (field: "file"), or provide base64 "fileData" in JSON body.',
        });
      }

      const result = await importVesselRankHierarchy(buffer);
      if (result.vesselsProcessed === 0 && result.errors.length > 0) {
        return res.status(400).json({
          error: result.errors[0],
          ...result,
        });
      }
      res.json(result);
    } catch (error: any) {
      if (handle413(error, res)) return;
      console.error("[VESSEL IMPORT] Error importing hierarchy:", error);
      res
        .status(500)
        .json({ error: "Failed to import vessel rank hierarchy" });
    }
  },

  /**
   * Stage 2: Import Assignments sheet from uploaded .xlsx.
   * Accepts multipart (field "file"), base64-JSON, or raw binary.
   */
  async importAssignments(req: Request, res: Response) {
    try {
      const buffer = await getBufferFromReq(req as any);
      if (!buffer) {
        return res.status(400).json({
          error: "No Excel file provided",
          message:
            'Upload via multipart/form-data (field: "file"), or provide base64 "fileData" in JSON body.',
        });
      }

      const result = await importCrewAssignments(buffer);
      if (
        result.success === false ||
        (result.primaryAssignedCount === 0 &&
          result.secondaryAssignedCount === 0 &&
          result.errors.length > 0)
      ) {
        return res.status(400).json({
          error:
            result.errors[0] ||
            "Validation failed for crew assignments import",
          ...result,
        });
      }
      res.json(result);
    } catch (error: any) {
      if (handle413(error, res)) return;
      console.error("[VESSEL IMPORT] Error importing assignments:", error);
      res.status(500).json({ error: "Failed to import crew assignments" });
    }
  },
};
