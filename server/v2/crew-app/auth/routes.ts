import { Router } from "express";
import rateLimit from "express-rate-limit";
import { crewAuthController } from "./controllers";
import { crewAuthMiddleware } from "./crewAuthMiddleware";

const router = Router();

// Login/refresh accept a raw credential per request, so they need a much
// tighter per-IP limiter than the app-wide 2000/min default — otherwise
// one IP can spray many identifiers with 5 free password guesses each
// (crewAuthService's per-identifier lockout doesn't help against that).
const authAttemptLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Too many login attempts. Please try again later." },
});

// ============================================
// CREW APP AUTH — isolated from legacy web auth
// ============================================
router.post("/login", authAttemptLimiter, crewAuthController.login);
router.post("/refresh", authAttemptLimiter, crewAuthController.refresh);
router.post("/logout", crewAuthMiddleware, crewAuthController.logout);
router.post("/set-password", crewAuthMiddleware, crewAuthController.setPassword);

export default router;
