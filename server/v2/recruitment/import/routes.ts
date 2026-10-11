import { Router } from "express";
import { authorizeImport, ImportAccessError } from "./access";
import { loadCatalogs } from "./catalogs";
import { generateTemplate } from "./workbook";
import { decodeFile, parseWorkbook } from "./parser";
import { persistCandidate, DuplicateImportError } from "./persistence";

export const candidateImportRouter = Router();
candidateImportRouter.use(async (req, res, next) => {
  try { res.locals.importActor = await authorizeImport(req); next(); }
  catch (error) {
    if (error instanceof ImportAccessError) res.status(403).json({ message: error.message });
    else { console.error("[Candidate import] Authorization failed", error); res.status(500).json({ message: "Unable to verify import access. No data was saved." }); }
  }
});
candidateImportRouter.get("/template", async (_req, res) => {
  try {
    const catalogs = await loadCatalogs();
    const own = res.locals.importActor.manningAgent;
    if (own) catalogs.agents = catalogs.agents.filter(a => a.value === own);
    const buffer = await generateTemplate(catalogs);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="Recruitment_Candidate_A1-A5.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    console.error("[Candidate import] Template failed", error);
    res.status(500).json({ message: "Unable to generate the template. Please try again." });
  }
});
for (const action of ["validate", "execute"] as const) candidateImportRouter.post(`/${action}`, async (req, res) => {
  let parsing = true;
  try {
    const file = decodeFile(req.body?.fileData, req.body?.fileName);
    const catalogs = await loadCatalogs();
    const own = res.locals.importActor.manningAgent;
    if (own) catalogs.agents = catalogs.agents.filter(a => a.value === own);
    const parsed = await parseWorkbook(file, catalogs);
    parsing = false;
    if (own && parsed.isValid) {
      if (!parsed.data.personal.length) parsed.data.personal.push({});
      parsed.data.personal[0].manningAgent = own;
    }
    if (action === "validate") {
      const { data, ...preview } = parsed; // Do not send all personal data back into UI/logs.
      res.json(preview);
    } else if (!parsed.isValid) {
      res.status(422).json({ message: "Correct the workbook errors before importing.", errors: parsed.errors });
    } else {
      const recCanUuid = await persistCandidate(parsed, res.locals.importActor.auditUuid);
      res.status(201).json({ success: true, recCanUuid, status: "Applied" });
    }
  } catch (error) {
    if (error instanceof DuplicateImportError) { res.status(409).json({ message: error.message }); return; }
    if (parsing && error instanceof Error) {
      res.status(400).json({ message: error.message }); return;
    }
    console.error(`[Candidate import] ${action} failed`, error);
    res.status(500).json({ message: action === "execute" ? "Import failed. No candidate data was saved. Please try again." : "Unable to validate this workbook. Check the file and try again." });
  }
});
