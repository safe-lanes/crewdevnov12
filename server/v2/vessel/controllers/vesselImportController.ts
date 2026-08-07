import { Request, Response } from "express";
import {
  parseCrewListZip,
  generateVesselImportWorkbook,
  importVesselRankHierarchy,
  importCrewAssignments,
} from "../services";

async function getBufferFromReq(req: Request): Promise<Buffer | null> {
  if (req.body && req.body.fileData) {
    return Buffer.from(req.body.fileData, "base64");
  }
  if (req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
    return req.body;
  }
  // Fallback: read stream chunks directly if express.raw wasn't invoked
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

export const vesselImportController = {
  /**
   * Parse a ZIP file of vessel crew lists (.docx) and return preview summary
   */
  async parseZip(req: Request, res: Response) {
    try {
      const buffer = await getBufferFromReq(req);
      if (!buffer) {
        return res.status(400).json({
          error: "No ZIP file provided",
          message: "Provide base64 'fileData' in JSON or raw binary ZIP file",
        });
      }

      const docs = await parseCrewListZip(buffer);
      const totalCrew = docs.reduce((acc, d) => acc + (d.entries?.length || 0), 0);

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
      console.error("[VESSEL IMPORT] Error parsing ZIP:", error);
      res.status(500).json({ error: "Failed to parse crew list ZIP archive" });
    }
  },

  /**
   * Ingest ZIP archive of .docx crew lists and generate downloadable 2-sheet Excel workbook
   */
  async generateWorkbook(req: Request, res: Response) {
    try {
      const buffer = await getBufferFromReq(req);
      if (!buffer) {
        return res.status(400).json({
          error: "No ZIP file provided",
          message: "Provide base64 'fileData' in JSON or raw binary ZIP file",
        });
      }

      const docs = await parseCrewListZip(buffer);
      const result = await generateVesselImportWorkbook(docs);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=vessel_crew_import.xlsx");
      res.send(result.buffer);
    } catch (error: any) {
      console.error("[VESSEL IMPORT] Error generating workbook:", error);
      res.status(500).json({ error: "Failed to generate vessel import workbook" });
    }
  },

  /**
   * Stage 1: Import VesselRankHierarchy sheet from uploaded .xlsx (supports multiple vessels)
   */
  async importHierarchy(req: Request, res: Response) {
    try {
      const buffer = await getBufferFromReq(req);
      if (!buffer) {
        return res.status(400).json({
          error: "No Excel file provided",
          message: "Provide base64 'fileData' in JSON or raw binary Excel file",
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
      console.error("[VESSEL IMPORT] Error importing hierarchy:", error);
      res.status(500).json({ error: "Failed to import vessel rank hierarchy" });
    }
  },

  /**
   * Stage 2: Import Assignments sheet from uploaded .xlsx (supports multiple vessels)
   */
  async importAssignments(req: Request, res: Response) {
    try {
      const buffer = await getBufferFromReq(req);
      if (!buffer) {
        return res.status(400).json({
          error: "No Excel file provided",
          message: "Provide base64 'fileData' in JSON or raw binary Excel file",
        });
      }

      const result = await importCrewAssignments(buffer);
      if (result.success === false || (result.primaryAssignedCount === 0 && result.secondaryAssignedCount === 0 && result.errors.length > 0)) {
        return res.status(400).json({
          error: result.errors[0] || "Validation failed for crew assignments import",
          ...result,
        });
      }
      res.json(result);
    } catch (error: any) {
      console.error("[VESSEL IMPORT] Error importing assignments:", error);
      res.status(500).json({ error: "Failed to import crew assignments" });
    }
  },
};
