import { eq, and, asc, ilike } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  masterTravelDocumentTypes,
  type MasterTravelDocumentType,
} from "../../../../shared/v2/masters/schema";

export class TravelDocumentTypeConflictError extends Error {
  constructor(name: string) {
    super(`Document type "${name}" already exists`);
    this.name = "TravelDocumentTypeConflictError";
  }
}

const ENTRY_ID_PREFIX = "DOC";

export class TravelDocumentTypeRepository {
  async findAll(): Promise<MasterTravelDocumentType[]> {
    const db = getDb();
    return db
      .select()
      .from(masterTravelDocumentTypes)
      .where(eq(masterTravelDocumentTypes.isDeleted, false))
      .orderBy(asc(masterTravelDocumentTypes.sortOrder), asc(masterTravelDocumentTypes.name));
  }

  private async findByNameAnyState(name: string): Promise<MasterTravelDocumentType | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTravelDocumentTypes)
      .where(ilike(masterTravelDocumentTypes.name, name));
    return rows[0];
  }

  private async nextEntryId(): Promise<string> {
    const db = getDb();
    const rows = await db
      .select({ entryId: masterTravelDocumentTypes.entryId })
      .from(masterTravelDocumentTypes);
    const maxSeq = rows.reduce((max: number, r: { entryId: string }) => {
      const match = r.entryId.match(new RegExp(`^${ENTRY_ID_PREFIX}(\\d+)$`));
      if (!match) return max;
      return Math.max(max, parseInt(match[1], 10));
    }, 0);
    return `${ENTRY_ID_PREFIX}${String(maxSeq + 1).padStart(3, "0")}`;
  }

  private async nextSortOrder(): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ sortOrder: masterTravelDocumentTypes.sortOrder })
      .from(masterTravelDocumentTypes);
    return rows.reduce((max: number, r: { sortOrder: number | null }) => Math.max(max, r.sortOrder ?? 0), 0) + 1;
  }

  async create(name: string, auditUserUuid?: string | null): Promise<MasterTravelDocumentType> {
    const db = getDb();
    const clash = await this.findByNameAnyState(name);
    if (clash) throw new TravelDocumentTypeConflictError(name);

    const entryId = await this.nextEntryId();
    const sortOrder = await this.nextSortOrder();
    const r = await db
      .insert(masterTravelDocumentTypes)
      .values({
        mtdtUuid: uuidv4(),
        entryId,
        name,
        isActive: true,
        sortOrder,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      })
      .returning();
    return r[0];
  }

  async updateRow(
    mtdtUuid: string,
    data: { name?: string; isActive?: boolean },
    auditUserUuid?: string | null,
  ): Promise<MasterTravelDocumentType | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTravelDocumentTypes)
      .where(and(eq(masterTravelDocumentTypes.mtdtUuid, mtdtUuid), eq(masterTravelDocumentTypes.isDeleted, false)));
    const existing = rows[0];
    if (!existing) return undefined;

    if (data.name !== undefined && data.name !== existing.name) {
      const clash = await this.findByNameAnyState(data.name);
      if (clash && clash.mtdtUuid !== mtdtUuid) {
        throw new TravelDocumentTypeConflictError(data.name);
      }
    }

    const r = await db
      .update(masterTravelDocumentTypes)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
        updatedByUuid: auditUserUuid || null,
      })
      .where(eq(masterTravelDocumentTypes.mtdtUuid, mtdtUuid))
      .returning();
    return r[0];
  }

  async deleteRow(mtdtUuid: string, auditUserUuid?: string | null): Promise<MasterTravelDocumentType | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTravelDocumentTypes)
      .where(and(eq(masterTravelDocumentTypes.mtdtUuid, mtdtUuid), eq(masterTravelDocumentTypes.isDeleted, false)));
    const existing = rows[0];
    if (!existing) return undefined;

    const r = await db
      .update(masterTravelDocumentTypes)
      .set({
        isDeleted: true,
        isActive: false,
        updatedAt: new Date(),
        updatedByUuid: auditUserUuid || null,
      })
      .where(eq(masterTravelDocumentTypes.mtdtUuid, mtdtUuid))
      .returning();
    return r[0];
  }
}
