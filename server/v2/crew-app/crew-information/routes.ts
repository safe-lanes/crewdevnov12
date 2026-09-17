import { Router } from "express";
import { crewAuthMiddleware, requireCrewPasswordReset } from "../auth";
import { requireCurrentCrew } from "./crewInformationGuard";
import { getInformation, updateSection, collectionHandler } from "./controller";

const router = Router();
const auth = [crewAuthMiddleware, requireCurrentCrew, requireCrewPasswordReset];
const bindParam = (name: string, value: string) => (req: any, _res: any, next: any) => {
  req.params[name] = value;
  next();
};
router.get("/", ...auth, getInformation);
for (const name of ["particulars", "personal", "contact", "family", "next-of-kin", "vessel-types"]) {
  router.put(`/${name}`, ...auth, bindParam("section", name), updateSection);
}
for (const name of ["children", "documents", "visas", "education", "licenses", "training", "sea-service"]) {
  router.get(`/${name}`, ...auth, bindParam("collection", name), collectionHandler);
  router.post(`/${name}`, ...auth, bindParam("collection", name), collectionHandler);
  router.patch(`/${name}/:uuid`, ...auth, bindParam("collection", name), collectionHandler);
  router.delete(`/${name}/:uuid`, ...auth, bindParam("collection", name), collectionHandler);
}
export default router;