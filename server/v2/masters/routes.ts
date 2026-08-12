import { Router } from "express";
import { mastersController, dataMasterController, trainingStatusController, trainingCategoryController } from "./controllers";

const router = Router();

router.get("/nationalities", mastersController.getNationalities);
router.get("/nationalities/:uuid", mastersController.getNationalityByUuid);

router.get("/vessels", mastersController.getVessels);
// /vessels/all must be registered before /vessels/:uuid to avoid "all" being treated as a UUID.
router.get("/vessels/all", mastersController.getAllVessels);
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

router.get("/training-statuses", trainingStatusController.list);
router.post("/training-statuses", trainingStatusController.create);
router.put("/training-statuses/group", trainingStatusController.groupUpdate);
router.put("/training-statuses/:uuid", trainingStatusController.updateRow);
router.delete("/training-statuses/:uuid", trainingStatusController.deleteRow);

router.get("/training-categories", trainingCategoryController.list);
router.post("/training-categories", trainingCategoryController.create);
router.put("/training-categories/group", trainingCategoryController.groupUpdate);
router.put("/training-categories/:uuid", trainingCategoryController.updateRow);
router.delete("/training-categories/:uuid", trainingCategoryController.deleteRow);

router.get("/data", dataMasterController.listMasters);
router.get("/data/:id", dataMasterController.getMaster);
router.post("/data", dataMasterController.createMaster);
router.put("/data/:id", dataMasterController.updateMaster);
router.delete("/data/:id", dataMasterController.deleteMaster);

router.get("/data/:id/entries", dataMasterController.getMasterEntries);
router.post("/data/:id/entries", dataMasterController.createMasterEntry);

router.get("/data-entries/:id", dataMasterController.getMasterEntry);
router.put("/data-entries/:id", dataMasterController.updateMasterEntry);
router.delete("/data-entries/:id", dataMasterController.deleteMasterEntry);

router.get("/external/:type", dataMasterController.getExternalMasterData);
router.post("/external/sync-all", dataMasterController.syncAllExternalMasterData);

export default router;
