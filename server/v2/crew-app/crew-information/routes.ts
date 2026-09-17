import { Router } from "express";
import { crewAuthMiddleware, requireCrewPasswordReset } from "../auth";
import { requireCurrentCrew } from "./crewInformationGuard";
import { getInformation, getCrewInformationMasters, updateSection, collectionHandler } from "./controller";
import {
  deleteCrewAttachment,
  listCrewAttachments,
  parseCrewAttachment,
  serveCrewAttachment,
  uploadCrewAttachment,
} from "./attachmentController";

const router = Router();
const auth = [crewAuthMiddleware, requireCurrentCrew, requireCrewPasswordReset];
const bindParam = (name: string, value: string) => (req: any, _res: any, next: any) => {
  req.params[name] = value;
  next();
};
router.get("/", ...auth, getInformation);
router.get("/masters", ...auth, getCrewInformationMasters);
for (const name of ["particulars", "personal", "contact", "family", "next-of-kin", "vessel-types"]) {
  router.put(`/${name}`, ...auth, bindParam("section", name), updateSection);
}
for (const name of ["children", "documents", "visas", "education", "licenses", "training", "sea-service"]) {
  router.get(`/${name}`, ...auth, bindParam("collection", name), collectionHandler);
  router.post(`/${name}`, ...auth, bindParam("collection", name), collectionHandler);
  router.patch(`/${name}/:uuid`, ...auth, bindParam("collection", name), collectionHandler);
  router.delete(`/${name}/:uuid`, ...auth, bindParam("collection", name), collectionHandler);
}
router.get("/:collection/:uuid/attachments", ...auth, listCrewAttachments);
router.post("/:collection/:uuid/attachments", ...auth, parseCrewAttachment, uploadCrewAttachment);
router.get("/:collection/:uuid/attachments/:attUuid/raw", ...auth, serveCrewAttachment);
router.delete("/:collection/:uuid/attachments/:attUuid", ...auth, deleteCrewAttachment);
export default router;