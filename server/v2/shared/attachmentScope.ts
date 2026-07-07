import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { masterVessels } from "../../../shared/schema";
import { crewMembersV2 } from "../../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../../shared/v2/vessel/schema";

/**
 * Helpers that resolve human-meaningful folder segments for attachment storage.
 *
 * Vessel-scoped attachments are grouped under a vessel's IMO number; crew-scoped
 * attachments under a crew member's employee number. When the preferred
 * identifier cannot be resolved, the stable underlying UUID is used as a
 * defensive fallback so files are never written to an empty/ambiguous folder.
 */

const VESSEL_FALLBACK = "unknown-vessel";
const CREW_FALLBACK = "unknown-crew";

/**
 * Resolve the vessel folder segment (IMO number) from a vessel UUID, falling
 * back to the vessel UUID itself when no IMO is recorded.
 */
export async function resolveVesselFolder(
  vesselUuid?: string | null,
): Promise<string> {
  const id = (vesselUuid || "").trim();
  if (!id) return VESSEL_FALLBACK;
  try {
    const db = getDb();
    const rows = await db
      .select({ imoNumber: masterVessels.imoNumber })
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, id))
      .limit(1);
    const imo = (rows[0]?.imoNumber || "").toString().trim();
    return imo || id;
  } catch {
    return id;
  }
}

/**
 * Resolve the vessel folder segment from a vessel-planning plan UUID by first
 * looking up the plan's vessel UUID, then resolving its IMO number.
 */
export async function resolveVesselFolderFromPlanUuid(
  planUuid?: string | null,
): Promise<string> {
  const id = (planUuid || "").trim();
  if (!id) return VESSEL_FALLBACK;
  try {
    const db = getDb();
    const rows = await db
      .select({ vesselUuid: vesselPlanningV2.vesselUuid })
      .from(vesselPlanningV2)
      .where(eq(vesselPlanningV2.planUuid, id))
      .limit(1);
    const vesselUuid = (rows[0]?.vesselUuid || "").trim();
    if (!vesselUuid) return id;
    return resolveVesselFolder(vesselUuid);
  } catch {
    return id;
  }
}

/**
 * Resolve the vessel folder segment from any entity row that carries a vessel
 * identifier. `uuidColumn` locates the row by its business UUID; `vesselColumn`
 * holds the vessel UUID used to look up the IMO number.
 */
export async function resolveVesselFolderByEntity(
  table: any,
  uuidColumn: any,
  vesselColumn: any,
  uuidValue?: string | null,
): Promise<string> {
  const id = (uuidValue || "").trim();
  if (!id) return VESSEL_FALLBACK;
  try {
    const db = getDb();
    const rows = await db
      .select({ vesselUuid: vesselColumn })
      .from(table)
      .where(eq(uuidColumn, id))
      .limit(1);
    const vesselUuid = (rows[0]?.vesselUuid || "").toString().trim();
    if (!vesselUuid) return id;
    return resolveVesselFolder(vesselUuid);
  } catch {
    return id;
  }
}

/**
 * Resolve the crew folder segment (employee number) from a crew UUID, falling
 * back to the crew UUID itself when no employee number is recorded.
 */
export async function resolveCrewFolder(
  crewUuid?: string | null,
): Promise<string> {
  const id = (crewUuid || "").trim();
  if (!id) return CREW_FALLBACK;
  try {
    const db = getDb();
    const rows = await db
      .select({ empNo: crewMembersV2.empNo })
      .from(crewMembersV2)
      .where(eq(crewMembersV2.crewUuid, id))
      .limit(1);
    const empNo = (rows[0]?.empNo || "").toString().trim();
    return empNo || id;
  } catch {
    return id;
  }
}

/**
 * Resolve the crew folder segment from any entity row that carries a crew_uuid.
 * Looks the row up by its business UUID, reads its crew_uuid, then resolves the
 * employee number.
 */
export async function resolveCrewFolderByEntity(
  table: any,
  uuidColumn: any,
  uuidValue?: string | null,
): Promise<string> {
  const id = (uuidValue || "").trim();
  if (!id) return CREW_FALLBACK;
  let crewUuid: string | null = null;
  try {
    const db = getDb();
    const rows = await db
      .select({ crewUuid: table.crewUuid })
      .from(table)
      .where(eq(uuidColumn, id))
      .limit(1);
    crewUuid = (rows[0]?.crewUuid || "").toString().trim() || null;
  } catch {
    crewUuid = null;
  }
  if (!crewUuid) return CREW_FALLBACK;
  return resolveCrewFolder(crewUuid);
}
