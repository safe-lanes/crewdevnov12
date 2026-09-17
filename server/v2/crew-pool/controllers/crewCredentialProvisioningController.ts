import { Request, Response } from "express";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { crewCredentialProvisioningService } from "../services/crewCredentialProvisioningService";

function domainFromContext(req: Request): string {
  const domain = tenantConnectionManager.getCurrentDomain() ?? req.jwtDomain ??
    (typeof req.user?.domain === "string" ? req.user.domain.trim() : undefined);
  if (!domain) throw new Error("Tenant domain context is unavailable");
  return domain;
}

function loginLink(req: Request): string {
  // Host headers are attacker-controlled. The signed tenant domain is the
  // fallback origin. Prefer an explicitly allowed HTTP(S) crew-app origin,
  // reusing the existing CORS setting rather than introducing another flag.
  const domain = domainFromContext(req);
  const configured = (process.env.CREW_APP_ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
  const candidate = configured.find(v => {
    try {
      const parsed = new URL(v);
      return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }) ?? (/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)
    ? `https://${domain}`
    : "");
  if (!candidate) throw new Error("Trusted crew app origin is unavailable");
  let origin: URL;
  try { origin = new URL(candidate); } catch { throw new Error("Trusted request origin is unavailable"); }
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password ||
      origin.search || origin.hash) throw new Error("Trusted request origin is unavailable");
  return `${origin.origin}/crew-app`;
}

async function execute(req: Request, res: Response, mode: "status" | "submit" | "retry" | "reissue") {
  try {
    if (req.user?.userType?.toLowerCase() !== "office") {
      return res.status(403).json({ error: "Office authorization is required" });
    }
    const domain = domainFromContext(req);
    const crewUuid = req.params.crewUuid;
    if (mode === "status") return res.json(await crewCredentialProvisioningService.status(crewUuid, domain));
    const data = await crewCredentialProvisioningService.provision(
      crewUuid, domain, loginLink(req), mode !== "submit", mode === "reissue",
    );
    return res.json(data);
  } catch (error: any) {
    const message = error?.message || "Credential provisioning failed";
    const status = /not found/i.test(message) ? 404 :
      /required|valid registered|origin|domain/.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}

export const crewCredentialProvisioningController = {
  getStatus: (req: Request, res: Response) => execute(req, res, "status"),
  submitApplication: (req: Request, res: Response) => execute(req, res, "submit"),
  retryEmail: (req: Request, res: Response) => execute(req, res, "retry"),
  reissue: (req: Request, res: Response) => execute(req, res, "reissue"),
};