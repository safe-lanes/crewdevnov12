/**
 * Crew Import Controller
 * 
 * Endpoints:
 * - GET  /import/template   — Download blank Excel template
 * - POST /import/validate   — Dry-run validation (no data written)
 * - POST /import/execute    — Confirmed import (transaction-based)
 */
import { Request, Response } from "express";
import { generateImportTemplate } from "../services/importTemplate";
import {
  validateImportData,
  executeImport,
  generateErrorReport,
} from "../services/crewImportService";

export const crewImportController = {
  /**
   * Download the blank crew import Excel template
   */
  async downloadTemplate(req: Request, res: Response) {
    try {
      const buffer = await generateImportTemplate();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=SAIL_Crew_Import_Template.xlsx"
      );
      res.send(buffer);
    } catch (error: any) {
      console.error("Error generating import template:", error);
      res.status(500).json({ error: "Failed to generate import template" });
    }
  },

  /**
   * Validate the uploaded Excel file without importing anything.
   * Returns a validation summary and any errors found.
   */
  async validate(req: Request, res: Response) {
    try {
      // The file should be sent as raw body (application/octet-stream)
      // or as a base64-encoded JSON field
      let buffer: Buffer;

      if (req.body && req.body.fileData) {
        // Base64 encoded file data in JSON body
        buffer = Buffer.from(req.body.fileData, "base64");
      } else if (req.body && Buffer.isBuffer(req.body)) {
        buffer = req.body;
      } else {
        return res.status(400).json({
          error: "No file provided",
          message: "Send the Excel file as base64-encoded 'fileData' field in JSON body, or as raw binary body with Content-Type: application/octet-stream",
        });
      }

      const result = await validateImportData(buffer);

      if (!result.isValid) {
        // Generate downloadable error report
        const errorReportBuffer = generateErrorReport(result.errors);
        const errorReportBase64 = errorReportBuffer.toString("base64");

        return res.json({
          ...result,
          errorReport: errorReportBase64,
          errorReportFilename: "SAIL_Import_Errors.xlsx",
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error validating import file:", error);
      res.status(500).json({
        error: "Failed to validate import file",
        message: error.message,
      });
    }
  },

  /**
   * Execute the actual import.
   * This runs validation first, then imports in a single transaction.
   * If any row fails, the entire import is rolled back.
   */
  async execute(req: Request, res: Response) {
    try {
      let buffer: Buffer;

      if (req.body && req.body.fileData) {
        buffer = Buffer.from(req.body.fileData, "base64");
      } else if (req.body && Buffer.isBuffer(req.body)) {
        buffer = req.body;
      } else {
        return res.status(400).json({
          error: "No file provided",
          message: "Send the Excel file as base64-encoded 'fileData' field in JSON body, or as raw binary body with Content-Type: application/octet-stream",
        });
      }

      const result = await executeImport(buffer);

      if (!result.success) {
        // Generate downloadable error report
        if (result.errors.length > 0) {
          const errorReportBuffer = generateErrorReport(result.errors);
          const errorReportBase64 = errorReportBuffer.toString("base64");

          return res.status(400).json({
            ...result,
            errorReport: errorReportBase64,
            errorReportFilename: "SAIL_Import_Errors.xlsx",
          });
        }
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error executing import:", error);
      res.status(500).json({
        error: "Import failed",
        message: error.message,
      });
    }
  },
};
