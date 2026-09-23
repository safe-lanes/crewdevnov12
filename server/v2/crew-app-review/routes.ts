import { Router } from "express";
import { listPending, approve, reject } from "./controller";
import { requirePermission } from "../../middleware/requirePermission";

// Mounted under /api/v2/ (unlike server/v2/crew-app's own isolated routes),
// so it gets the standard tenant+auth middleware automatically, plus real
// server-side RBAC via requirePermission — see migrations/0217 for the
// 'Crew Portal Submissions' menu this checks against.
const router = Router();

router.get("/pending", requirePermission("Crew Portal Submissions", "view"), listPending);
router.post("/:pendingUuid/approve", requirePermission("Crew Portal Submissions", "edit"), approve);
router.post("/:pendingUuid/reject", requirePermission("Crew Portal Submissions", "edit"), reject);

export default router;
