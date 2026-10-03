import { Router } from "express";
import { listPending, approve, reject } from "./controller";
import { requirePermission } from "../../middleware/requirePermission";
import { closeErpCommand, erpWorkerHealth, listErpCommands, readBackErpCommand, requeueErpCommand, resolveErpCommand } from "./erpCommandOperationsController";
import { completePrivacyRequest, executePrivacyDeletion, listOfficePrivacyRequests, privacyRequestAudit, privacyTransition } from "./privacyRequestController";

// Mounted under /api/v2/ (unlike server/v2/crew-app's own isolated routes),
// so it gets the standard tenant+auth middleware automatically, plus real
// server-side RBAC via requirePermission — see migrations/0217 for the
// 'Crew Portal Submissions' menu this checks against.
const router = Router();

router.get("/pending", requirePermission("Crew Portal Submissions", "view"), listPending);
router.post("/:pendingUuid/approve", requirePermission("Crew Portal Submissions", "edit"), approve);
router.post("/:pendingUuid/reject", requirePermission("Crew Portal Submissions", "edit"), reject);
router.get("/erp-commands/health", requirePermission("ERP Command Operations", "view"), erpWorkerHealth);
router.get("/erp-commands", requirePermission("ERP Command Operations", "view"), listErpCommands);
router.post("/erp-commands/:commandUuid/read-back", requirePermission("ERP Command Operations", "view"), readBackErpCommand);
router.post("/erp-commands/:commandUuid/resolve", requirePermission("ERP Command Operations", "edit"), resolveErpCommand);
router.post("/erp-commands/:commandUuid/requeue", requirePermission("ERP Command Operations", "edit"), requeueErpCommand);
router.post("/erp-commands/:commandUuid/close", requirePermission("ERP Command Operations", "edit"), closeErpCommand);
router.get("/privacy-requests", requirePermission("Privacy Request Operations", "view"), listOfficePrivacyRequests);
router.get("/privacy-requests/:requestUuid/audit", requirePermission("Privacy Request Operations", "view"), privacyRequestAudit);
router.post("/privacy-requests/:requestUuid/verify", requirePermission("Privacy Request Operations", "edit"), privacyTransition("verify"));
router.post("/privacy-requests/:requestUuid/approve", requirePermission("Privacy Request Operations", "edit"), privacyTransition("approve"));
router.post("/privacy-requests/:requestUuid/reject", requirePermission("Privacy Request Operations", "edit"), privacyTransition("reject"));
router.post("/privacy-requests/:requestUuid/legal-hold", requirePermission("Privacy Request Operations", "edit"), privacyTransition("legal_hold"));
router.post("/privacy-requests/:requestUuid/execute-deletion", requirePermission("Privacy Request Operations", "edit"), executePrivacyDeletion);
router.post("/privacy-requests/:requestUuid/complete", requirePermission("Privacy Request Operations", "edit"), completePrivacyRequest);

export default router;
