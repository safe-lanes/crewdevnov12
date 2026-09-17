import { Request, Response } from "express";
import { z } from "zod";
import { crewAuthService } from "../services";
import {
  crewLoginRequestSchema,
  crewRefreshRequestSchema,
  crewLogoutRequestSchema,
  crewSetPasswordRequestSchema,
} from "@shared/v2/crew-app/types";

function statusForError(message: string): number {
  if (
    message === "Invalid credentials" ||
    message === "Invalid refresh token" ||
    message === "Current password is incorrect" ||
    message.startsWith("Account locked until")
  ) {
    return 401;
  }
  return 500;
}

export const crewAuthController = {
  async login(req: Request, res: Response) {
    try {
      const data = crewLoginRequestSchema.parse(req.body);
      const result = await crewAuthService.login(data);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      const message = error?.message ?? "Login failed";
      const status = statusForError(message);
      if (status === 500) {
        console.error("Error during crew login:", error);
        return res.status(500).json({ error: "Login failed" });
      }
      res.status(status).json({ error: message });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const data = crewRefreshRequestSchema.parse(req.body);
      const result = await crewAuthService.refresh(data);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      const message = error?.message ?? "Refresh failed";
      const status = statusForError(message);
      if (status === 500) {
        console.error("Error during crew token refresh:", error);
        return res.status(500).json({ error: "Refresh failed" });
      }
      res.status(status).json({ error: message });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const data = crewLogoutRequestSchema.parse(req.body);
      await crewAuthService.logout(data, { credentialId: req.crewUser!.credentialId });
      res.status(200).json({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error during crew logout:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  },

  async setPassword(req: Request, res: Response) {
    try {
      const data = crewSetPasswordRequestSchema.parse(req.body);
      await crewAuthService.setPassword(data, { credentialId: req.crewUser!.credentialId });
      res.status(200).json({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      const message = error?.message ?? "Failed to set password";
      const status = statusForError(message);
      if (status === 500) {
        console.error("Error setting crew password:", error);
        return res.status(500).json({ error: "Failed to set password" });
      }
      res.status(status).json({ error: message });
    }
  },
};
