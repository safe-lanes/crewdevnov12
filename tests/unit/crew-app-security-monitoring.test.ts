import { afterEach, describe, expect, it } from "vitest";
import {
  emitCrewSecurityEvent,
  registerCrewSecurityAlertSink,
  registerCrewSecurityEventSink,
  resetCrewSecurityMonitoringForTests,
} from "@server/v2/crew-app/monitoring/securityEvents";

afterEach(() => resetCrewSecurityMonitoringForTests());

describe("crew app security monitoring", () => {
  it("emits only pseudonymized, allowlisted metadata", () => {
    const events: any[] = [];
    registerCrewSecurityEventSink(event => events.push(event));
    const serialized = JSON.stringify(emitCrewSecurityEvent({
      event: "login_failure", correlationId: "request-1",
      actorId: "TEST_PASSPORT_123456", tenantId: "customer.example",
      resourceType: "crew_credential", result: "denied", reasonCode: "invalid_credentials",
    }));
    expect(events).toHaveLength(1);
    expect(serialized).not.toContain("TEST_PASSPORT_123456");
    expect(serialized).not.toContain("customer.example");
    expect(events[0]).not.toHaveProperty("payload");
  });

  it("raises an alert after five repeated login failures", () => {
    const alerts: any[] = [];
    registerCrewSecurityAlertSink(alert => alerts.push(alert));
    for (let i = 0; i < 5; i++) emitCrewSecurityEvent({ event: "login_failure", actorId: "crew-1", tenantId: "tenant-1", result: "denied", reasonCode: "invalid_credentials" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ alert: "repeated_login_failure", count: 5 });
  });

  it("raises immediate alerts for refresh replay and tenant violations", () => {
    const alerts: any[] = [];
    registerCrewSecurityAlertSink(alert => alerts.push(alert));
    emitCrewSecurityEvent({ event: "refresh_token_reuse", actorId: 4, tenantId: "tenant-1", result: "warning", reasonCode: "rotated_token_replayed" });
    emitCrewSecurityEvent({ event: "tenant_mismatch", actorId: 4, tenantId: "tenant-2", result: "denied", reasonCode: "credential_domain_mismatch" });
    expect(alerts.map(row => row.alert)).toEqual(["refresh_replay", "tenant_violation"]);
  });
});
