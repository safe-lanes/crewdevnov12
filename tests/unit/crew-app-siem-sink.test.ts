import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitCrewSecurityEvent, resetCrewSecurityMonitoringForTests } from "@server/v2/crew-app/monitoring/securityEvents";
import { crewSiemHealth, flushCrewSiem, initializeCrewSiem, resetCrewSiemForTests } from "@server/v2/crew-app/monitoring/siemSink";

const original = { ...process.env };
beforeEach(() => {
  process.env = { ...original, CREW_APP_SIEM_URL: "https://siem.example/ingest", CREW_APP_SIEM_TOKEN: "x".repeat(40) };
  resetCrewSecurityMonitoringForTests(); resetCrewSiemForTests();
});
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...original }; resetCrewSecurityMonitoringForTests(); resetCrewSiemForTests(); });

describe("crew SIEM delivery", () => {
  it("delivers pseudonymized signed events without credentials", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch); initializeCrewSiem();
    emitCrewSecurityEvent({ event: "login_failure", actorId: "passport-secret", tenantId: "tenant-secret", result: "denied", reasonCode: "invalid_credentials" });
    expect(await flushCrewSiem()).toBe(true);
    const [url, request] = fetch.mock.calls[0]; const body = String(request.body);
    expect(url).toBe("https://siem.example/ingest"); expect(request.headers["X-SAIL-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(body).not.toContain("passport-secret"); expect(body).not.toContain("tenant-secret"); expect(body).not.toContain("x".repeat(40));
    expect(crewSiemHealth()).toMatchObject({ queued: 0, delivered: 1, dropped: 0 });
  });

  it("retries a transient delivery failure", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch); initializeCrewSiem();
    emitCrewSecurityEvent({ event: "malware_detection", result: "denied", reasonCode: "malware_detected" });
    expect(await flushCrewSiem()).toBe(true); expect(fetch).toHaveBeenCalledTimes(3); expect(crewSiemHealth()).toMatchObject({ delivered: 2, failed: 1 });
  });

  it("fails production startup closed without SIEM configuration", () => {
    delete process.env.CREW_APP_SIEM_URL; delete process.env.CREW_APP_SIEM_TOKEN; process.env.NODE_ENV = "production";
    expect(() => initializeCrewSiem()).toThrow("Production requires");
  });
});
