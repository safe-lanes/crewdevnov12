import { beforeAll, describe, expect, it } from "vitest";

const API_BASE = "http://localhost:5000";

describe("Manning Agents with active crew API", () => {
  let filteredAgents: Array<{ id: string; name: string; isActive: boolean; isDeleted: boolean }>;
  let masterAgents: Array<{ id: string; name: string }>;

  beforeAll(async () => {
    const [filteredResponse, masterResponse] = await Promise.all([
      fetch(`${API_BASE}/api/v2/masters/manning-agents/with-active-crew`),
      fetch(`${API_BASE}/api/v2/masters/manning-agents`),
    ]);

    expect(filteredResponse.status).toBe(200);
    expect(masterResponse.status).toBe(200);

    filteredAgents = await filteredResponse.json();
    masterAgents = await masterResponse.json();
  });

  it("returns only active, non-deleted master agents", () => {
    expect(Array.isArray(filteredAgents)).toBe(true);
    for (const agent of filteredAgents) {
      expect(agent.isActive).toBe(true);
      expect(agent.isDeleted).toBe(false);
    }
  });

  it("returns each qualifying Manning Agent once", () => {
    const ids = filteredAgents.map(agent => agent.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns a subset of the unchanged Manning Agent master source", () => {
    const masterIds = new Set(masterAgents.map(agent => agent.id));
    expect(filteredAgents.every(agent => masterIds.has(agent.id))).toBe(true);
  });
});