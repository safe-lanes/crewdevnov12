import { Request, Response } from "express";
import { mintAssistantToken } from "../services/assistantTokenService";

export class AssistantTokenController {
  async getToken(req: Request, res: Response) {
    try {
      const result = await mintAssistantToken(req);
      res.setHeader("Cache-Control", "no-store");
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error, message: result.message });
      }
      return res.json({ token: result.token, expiresInSec: result.expiresInSec });
    } catch (error) {
      console.error("[AssistantTokenController] Failed to mint assistant token:", error);
      return res.status(500).json({ error: "assistant_token_failed", message: "Failed to create assistant token" });
    }
  }
}
