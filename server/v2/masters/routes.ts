import { Router } from "express";
import { mastersController } from "./controllers";

const router = Router();

router.get("/nationalities", mastersController.getNationalities);
router.get("/nationalities/:uuid", mastersController.getNationalityByUuid);

router.get("/vessels", mastersController.getVessels);
router.get("/vessels/:uuid", mastersController.getVesselByUuid);

router.get("/vessel-types", mastersController.getVesselTypes);
router.get("/vessel-types/:uuid", mastersController.getVesselTypeByUuid);

router.get("/additional-groups", mastersController.getAdditionalGroups);
router.get("/additional-groups/:uuid", mastersController.getAdditionalGroupByUuid);

router.get("/ports", mastersController.getPorts);
router.get("/ports/:uuid", mastersController.getPortByUuid);

router.get("/fleet-groups", mastersController.getFleetGroups);
router.get("/fleet-groups/:uuid", mastersController.getFleetGroupByUuid);

router.get("/languages", mastersController.getLanguages);
router.get("/languages/:uuid", mastersController.getLanguageByUuid);

router.get("/countries", mastersController.getCountries);
router.get("/countries/:uuid", mastersController.getCountryByUuid);

router.get("/users", mastersController.getUsers);
router.get("/users/:uuid", mastersController.getUserByUuid);

router.get("/licenses-dce", mastersController.getLicensesDce);
router.get("/licenses-dce/:id", mastersController.getLicenseDceById);

router.get("/manning-agents", mastersController.getManningAgents);
router.get("/manning-agents/:id", mastersController.getManningAgentById);

router.get("/crew-pools", mastersController.getCrewPools);
router.get("/crew-pools/:id", mastersController.getCrewPoolById);

router.get("/appraisal-types", mastersController.getAppraisalTypes);
router.get("/appraisal-types/:id", mastersController.getAppraisalTypeById);

export default router;
