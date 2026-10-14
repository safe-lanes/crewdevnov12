import fs from "node:fs/promises";

export function assertFixtureReleasePolicy(policy, registeredVessels) {
  if (policy?.mode !== "conditional" || !policy.sets?.length)
    throw new Error("Verification release refused: use conditions restricted to a registered fixture-only vessel, never applies to all or manual only.");
  for (const set of policy.sets) {
    const vessel = set.conditions?.find(c => c.dimensionKey === "vessel" && c.operator === "in");
    if (!Array.isArray(vessel?.value) || !vessel.value.length ||
        vessel.value.some(id => !registeredVessels.includes(id)))
      throw new Error("Verification release refused: every Or card must restrict the form to registered fixture-only vessels.");
  }
}

export async function fixtureVesselAllowlist() {
  // Explicit registration only. No name heuristic, prefix or auto-discovery.
  return JSON.parse(await fs.readFile("docs/company-form-verification-vessels.json", "utf8")).vesselUuids;
}
