import type { RuleDimension } from "../../../../shared/v2/forms-engine/ruleDimensions";

const scalar = (key: string, label: string): RuleDimension =>
  ({ key, label, kind: "scalar", operators: ["in", "not_in"], available: true });
export const crewAssignmentRuleDimensions: readonly RuleDimension[] = [
  scalar("vessel_type", "Vessel type"),
  scalar("vessel", "Vessel"),
  { ...scalar("fleet_group", "Fleet group"), kind: "set", operators: ["contains_any", "contains_all"] },
  { ...scalar("additional_group", "Additional group"), kind: "set", operators: ["contains_any", "contains_all"] },
  scalar("nationality", "Nationality"),
  scalar("rank", "Contract rank"),
  scalar("manning_agent", "Manning agent"),
  scalar("crew_pool", "Crew pool"),
  { key: "first_ever", label: "First-ever with company", kind: "boolean", operators: ["is"], available: true },
  { key: "first_in_rank", label: "First-in-rank", kind: "boolean", operators: ["is"], available: true },
  ...["owner", "flag"].map(key => ({
    ...scalar(key, key === "owner" ? "Vessel owner" : "Flag"),
    available: false, unavailableReason: "Not yet available: the parent application has not supplied master data",
  })),
];
