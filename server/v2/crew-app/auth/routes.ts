import { Router } from "express";
import { crewAuthController } from "./controllers";
import { crewAuthMiddleware } from "./crewAuthMiddleware";

const router = Router();

// ============================================
// CREW APP AUTH — isolated from legacy web auth
// ============================================
router.post("/login", crewAuthController.login);
router.post("/refresh", crewAuthController.refresh);
router.post("/logout", crewAuthMiddleware, crewAuthController.logout);
router.post("/set-password", crewAuthMiddleware, crewAuthController.setPassword);

export default router;
