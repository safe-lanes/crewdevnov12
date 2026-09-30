import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { masterVessels } from "../../../../shared/schema";

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InvalidAssignmentVesselError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAssignmentVesselError";
  }
}

// Application feedback before an assignment write. The database trigger is
// authoritative, including for direct SQL writes and concurrent master changes.
export async function resolveAssignmentVesselUuid(
  value: string | null | undefined,
  db: any = getDb(),
): Promise<string | null | undefined> {
  if (value == null) return value;
  if (typeof value !== "string" || !CANONICAL_UUID.test(value)) {
    throw new InvalidAssignmentVesselError("Assignment vessel ID must be a correctly formed UUID");
  }
  const matches: { vesselUuid: string | null }[] = await db.select({ vesselUuid: masterVessels.vesselUuid })
    .from(masterVessels)
    .where(sql`lower(${masterVessels.vesselUuid}) = lower(${value}) AND ${masterVessels.isDeleted} IS NOT TRUE`)
    .limit(2);
  if (matches.length !== 1 || !matches[0].vesselUuid) {
    throw new InvalidAssignmentVesselError(
      matches.length > 1
        ? "Assignment vessel ID is ambiguous in the vessel master"
        : "Assignment vessel ID is not present in the active vessel master",
    );
  }
  return matches[0].vesselUuid;
}