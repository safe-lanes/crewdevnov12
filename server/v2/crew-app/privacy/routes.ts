import { Router } from "express";
import { desc, and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { crewAuthMiddleware, requireCrewPasswordReset } from "../auth";
import { requireCurrentCrew } from "../crew-information/crewInformationGuard";
import { getDb } from "../../db";
import { appCrewPrivacyRequests } from "../../../../shared/v2/crew-app/schema";
import { emitCrewSecurityEvent } from "../monitoring/securityEvents";

const router = Router();
const auth = [crewAuthMiddleware, requireCurrentCrew, requireCrewPasswordReset];
const createSchema = z.object({ requestType: z.enum(["access", "export", "correction", "deletion"]), reason: z.string().trim().max(2000).optional() }).strict();

router.get("/", ...auth, async (req, res) => {
  const rows = await getDb().select({ requestUuid: appCrewPrivacyRequests.requestUuid, requestType: appCrewPrivacyRequests.requestType, status: appCrewPrivacyRequests.status, legalHold: appCrewPrivacyRequests.legalHold, resolutionNotes: appCrewPrivacyRequests.resolutionNotes, createdAt: appCrewPrivacyRequests.createdAt, completedAt: appCrewPrivacyRequests.completedAt })
    .from(appCrewPrivacyRequests).where(and(eq(appCrewPrivacyRequests.domain, req.crewUser!.domain), eq(appCrewPrivacyRequests.crewUuid, req.crewUser!.crewUuid)))
    .orderBy(desc(appCrewPrivacyRequests.createdAt)).limit(50);
  res.setHeader("Cache-Control", "no-store"); res.json(rows);
});

router.post("/", ...auth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() }); return; }
  const [created] = await getDb().insert(appCrewPrivacyRequests).values({ requestUuid: uuidv4(), domain: req.crewUser!.domain, crewUuid: req.crewUser!.crewUuid, requestType: parsed.data.requestType, reason: parsed.data.reason ?? null, status: "submitted", correlationId: req.requestId ?? null }).returning();
  emitCrewSecurityEvent({ event: "privacy_request_transition", correlationId: req.requestId, actorId: req.crewUser!.credentialId, tenantId: req.crewUser!.domain, resourceType: "privacy_request", result: "success", reasonCode: "submitted" });
  res.status(202).json({ requestUuid: created.requestUuid, requestType: created.requestType, status: created.status, message: "Request submitted for review. Submission does not mean ERP records have been deleted or changed." });
});

export default router;
