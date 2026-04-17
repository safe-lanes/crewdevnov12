import { Router } from "express";
import { ensureAuthUser, requireAdminRole } from "./middleware";
import { adminUsersController } from "./controller";

const router = Router();

router.use(ensureAuthUser, requireAdminRole);

router.get("/username-available", adminUsersController.usernameAvailable);
router.get("/", adminUsersController.list);
router.get("/:uuid", adminUsersController.getOne);
router.post("/", adminUsersController.create);
router.patch("/:uuid", adminUsersController.update);

export default router;
