import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { readFileSync } from "node:fs";

const { getCurrentDomain, status, provision } = vi.hoisted(() => ({
  getCurrentDomain: vi.fn(),
  status: vi.fn(),
  provision: vi.fn(),
}));

vi.mock("@server/utils/tenantConnectionManager", () => ({
  tenantConnectionManager: { getCurrentDomain },
}));

vi.mock("@server/v2/crew-pool/services/crewCredentialProvisioningService", () => ({
  crewCredentialProvisioningService: { status, provision },
}));

import { crewCredentialProvisioningController } from "@server/v2/crew-pool/controllers/crewCredentialProvisioningController";
import { buildCrewCredentialEmail } from "@server/v2/crew-pool/templates/crewCredentialEmailTemplate";

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  vi.mocked(res.json).mockReturnValue(res);
  return res;
}

function request(userType: string, domain = "tenant.example.com") {
  return {
    params: { crewUuid: "crew-uuid" },
    user: { id: 42, domain, userType },
  } as unknown as Request;
}

describe("crew credential provisioning contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentDomain.mockReturnValue(null);
    status.mockResolvedValue({ status: "not_provisioned", credentialExists: false });
    provision.mockResolvedValue({ status: "sent", credentialExists: true, email: "crew@example.com" });
    process.env.CREW_APP_ALLOWED_ORIGINS = "https://crew.example.com";
  });

  afterEach(() => {
    delete process.env.CREW_APP_ALLOWED_ORIGINS;
  });

  it("fails closed for non-office web identities", async () => {
    const res = response();
    await crewCredentialProvisioningController.getStatus(request("Ship"), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(status).not.toHaveBeenCalled();
  });

  it("uses the signed tenant domain and configured crew-app origin", async () => {
    const res = response();
    await crewCredentialProvisioningController.submitApplication(request("Office"), res);
    expect(provision).toHaveBeenCalledWith(
      "crew-uuid",
      "tenant.example.com",
      "https://crew.example.com/crew-app",
      false,
      false,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("keeps the public submit route aligned with the client contract", () => {
    const routes = readFileSync("server/v2/crew-pool/routes.ts", "utf8");
    expect(routes).toContain('"/crew/:crewUuid/submit-application"');
    expect(routes).toContain('requirePermission("Crew Database", "create")');
    expect(routes).toContain('requirePermission("Crew Database", "edit")');
    expect(routes).toContain('requirePermission("Crew Database", "view")');
    expect(routes).not.toContain('"/crew/:crewUuid/mobile-account/submit-application"');
  });

  it("renders every required credential field and escapes untrusted content", () => {
    const email = buildCrewCredentialEmail({
      firstName: "<Crew>",
      domain: "tenant.example.com",
      empNo: "EMP-42",
      temporaryPassword: "one&time",
      loginLink: "https://crew.example.com/crew-app",
    });
    expect(email.html).toContain("&lt;Crew&gt;");
    expect(email.html).toContain("tenant.example.com");
    expect(email.html).toContain("EMP-42");
    expect(email.html).toContain("one&amp;time");
    expect(email.html).toContain("https://crew.example.com/crew-app");
    expect(email.html).toMatch(/change it immediately/i);
  });
});