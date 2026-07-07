import { Router } from "express";
import { testCasesController } from "./controllers/testCasesController";

const router = Router();

router.get("/", testCasesController.getAll);
router.get("/:uuid", testCasesController.getByUuid);
router.post("/", testCasesController.create);
router.patch("/:uuid", testCasesController.update);
router.delete("/:uuid", testCasesController.delete);

export default router;
