const TRUE_VALUES = new Set(["true", "1", "yes", "active"]);
const FALSE_VALUES = new Set(["false", "0", "no", "inactive"]);
const NON_OPERATIONAL_STATUSES = new Set(["archived", "deleted", "inactive"]);
const VESSEL_LABEL_COLLATOR = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return undefined;
}

export function isOperationalVessel(vessel: Record<string, unknown>): boolean {
  const deleted = readBoolean(vessel.isDeleted ?? vessel.is_deleted ?? vessel.deleted);
  const archived = readBoolean(vessel.isArchived ?? vessel.is_archived ?? vessel.archived);
  const active = readBoolean(vessel.isActive ?? vessel.is_active ?? vessel.active);
  const status = typeof vessel.status === "string" ? vessel.status.trim().toLowerCase() : "";
  const archivedAt = vessel.archivedAt ?? vessel.archived_at;

  if (deleted === true || archived === true || archivedAt != null) return false;
  if (active === false || NON_OPERATIONAL_STATUSES.has(status)) return false;
  return active === true || status === "active";
}

export function sortVesselOptionsByLabel<T extends { label: string }>(
  options: readonly T[],
): T[] {
  return [...options].sort((left, right) =>
    VESSEL_LABEL_COLLATOR.compare(left.label, right.label),
  );
}