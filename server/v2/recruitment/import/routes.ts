import { Router } from "express";
import { authorizeImport, ImportAccessError } from "./access";
import { loadCatalogs } from "./catalogs";
import { generateTemplate } from "./workbook";
import { decodeFile, parseWorkbook } from "./parser";
import { persistCandidate, DuplicateImportError } from "./persistence";
import { WorkbookValidationError, logImportFailure } from "./errors";

export const candidateImportRouter = Router();
candidateImportRouter.use(async (req, res, next) => {
  try { res.locals.importActor = await authorizeImport(req); next(); }
  catch (error) {
    if (error instanceof ImportAccessError) res.status(403).json({ code: "ACCESS_DENIED", message: error.message });
    else { logImportFailure("authorization", error); res.status(500).json({ code: "AUTH_UNAVAILABLE", message: "Unable to verify import access. No data was saved. Please try again later." }); }
  }
});
candidateImportRouter.get("/template", async (_req, res) => {
  try {
    const catalogs = await loadCatalogs();
    const buffer = await generateTemplate(catalogs);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="Recruitment_Candidate_A1-A5.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    logImportFailure("template", error);
    res.status(500).json({ code: "TEMPLATE_UNAVAILABLE", message: "Unable to generate the template. Please try again later." });
  }
});
for (const action of ["validate", "execute"] as const) candidateImportRouter.post(`/${action}`, async (req, res) => {
  let stage: "file" | "catalogs" | "parse" | "persist" = "file";
  try {
    const file = decodeFile(req.body?.fileData, req.body?.fileName);
    stage = "catalogs";
    const catalogs = await loadCatalogs();
    stage = "parse";
    const parsed = await parseWorkbook(file, catalogs);
    if (action === "validate") {
      const { data, ...preview } = parsed; // Do not send all personal data back into UI/logs.
      res.json(preview);
    } else if (!parsed.isValid) {
      res.status(422).json({ code: "CELL_VALIDATION", message: "Correct the workbook errors before importing.", errors: parsed.errors });
    } else {
      stage = "persist";
      const recCanUuid = await persistCandidate(parsed, res.locals.importActor.auditUuid);
      res.status(201).json({ success: true, recCanUuid, status: "Applied" });
    }
  } catch (error) {
    if (error instanceof DuplicateImportError) { res.status(409).json({ code: "DUPLICATE_IMPORT", message: error.message }); return; }
    if (error instanceof WorkbookValidationError) {
      res.status(400).json({ code: error.code, message: error.message, recovery: error.recovery }); return;
    }
    logImportFailure(`${action}/${stage}`, error);
    res.status(500).json({
      code: "SERVICE_UNAVAILABLE",
      message: stage === "catalogs" ? "The current master lists are unavailable. Please try again later; you do not need to change your workbook." :
        action === "execute" ? "Import failed. No candidate data was saved. Please try again later." :
          "Validation could not finish because of a server problem. Please try again later; you do not need to change your workbook.",
    });
  }
});
