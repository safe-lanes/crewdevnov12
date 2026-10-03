import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plan = readFileSync("docs/security/crew-mobile-maritime-performance-test-plan.md", "utf8");
const scenarios = JSON.parse(readFileSync("tests/performance/maritime-network-scenarios.json", "utf8"));

describe("maritime performance test assets", () => {
  it.each([
    "normal", "latency-500ms", "latency-1s", "throughput-20KBps", "throughput-10KBps",
    "packet-loss-2pct", "packet-loss-5pct", "temporary-disconnect",
  ])("defines scenario %s", name => expect(scenarios.some((row: any) => row.name === name)).toBe(true));

  it.each([
    "Profile read", "change submission", "Approval and rejection", "Operation-status lookup",
    "upload", "download", "Offline queue", "ERP ambiguity", "BFF restarts", "Outbox worker restarts",
  ])("covers workflow/fault %s", item => expect(plan.toLowerCase()).toContain(item.toLowerCase()));

  it("does not claim unexecuted performance results", () => {
    expect(plan).toContain("Production performance and maritime-network readiness remain **NOT VERIFIED**");
    expect(plan).toContain("Quantitative performance clearance remains **NOT DEFINED**");
  });
});
