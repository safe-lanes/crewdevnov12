import { and, asc, eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { masterUsers } from "../../../../shared/schema";
import { admFormsV2, admFormVersionsV2 } from "../../../../shared/v2/admin/schema";
import { frmFormParts, frmSections } from "../../../../shared/v2/forms-engine/schema";

export class FormPartError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 409) {
    super(message);
  }
}

type Executor = any;

// "dynamic" is the only opt-in category. Existing SAIL categories (and any
// unknown future category) do not acquire skeleton-edit rights by being drafts.
const DYNAMIC_CATEGORY = "dynamic";

async function guardedVersion(tx: Executor, fvUuid: string, actorId: number) {
  // Serialize against release and concurrent part changes before checking status.
  await tx.execute(sql`SELECT id FROM adm_form_versions_v2 WHERE fv_uuid = ${fvUuid} FOR UPDATE`);
  const [version] = await tx.select({
    formUuid: admFormsV2.formUuid,
    category: admFormsV2.category,
    status: admFormVersionsV2.status,
  }).from(admFormVersionsV2)
    .innerJoin(admFormsV2, eq(admFormsV2.id, admFormVersionsV2.formId))
    .where(and(
      eq(admFormVersionsV2.fvUuid, fvUuid),
      eq(admFormVersionsV2.isDeleted, false),
      eq(admFormsV2.isDeleted, false),
    ));
  if (!version) throw new FormPartError("Form version not found", 404);
  if (version.status !== "draft") throw new FormPartError("Only draft versions allow part editing", 409);
  if (version.category !== DYNAMIC_CATEGORY) {
    throw new FormPartError("Part editing is available only for dynamic forms", 403);
  }
  const [actor] = await tx.select({ userUuid: masterUsers.userUuid })
    .from(masterUsers).where(eq(masterUsers.id, actorId)).limit(1);
  if (!actor) throw new FormPartError("Authenticated user not found", 403);
  return { formUuid: version.formUuid, auditIdentity: actor.userUuid || String(actorId) };
}

async function activePart(tx: Executor, fvUuid: string, formUuid: string, partUuid: string) {
  const [part] = await tx.select().from(frmFormParts).where(and(
    eq(frmFormParts.formPartUuid, partUuid),
    eq(frmFormParts.formVersionUuid, fvUuid),
    eq(frmFormParts.formUuid, formUuid),
    eq(frmFormParts.isDeleted, false),
  ));
  if (!part) throw new FormPartError("Version-owned part not found", 404);
  return part;
}

export const formPartService = {
  async create(fvUuid: string, input: { part_code: string; part_title: string; is_office_only: boolean }, actorId: number) {
    return getDb().transaction(async (tx: Executor) => {
      const { formUuid, auditIdentity } = await guardedVersion(tx, fvUuid, actorId);
      // The version/code unique index also includes soft-deleted parts; fail
      // explicitly rather than silently resurrecting or returning a DB 500.
      const [collision] = await tx.select({ id: frmFormParts.id }).from(frmFormParts).where(and(
        eq(frmFormParts.formVersionUuid, fvUuid),
        eq(frmFormParts.partCode, input.part_code),
      ));
      if (collision) throw new FormPartError(`Part code ${input.part_code} is already used in this version`, 409);
      const [last] = await tx.select({ sortOrder: frmFormParts.sortOrder }).from(frmFormParts)
        .where(and(eq(frmFormParts.formVersionUuid, fvUuid), eq(frmFormParts.isDeleted, false)))
        .orderBy(sql`${frmFormParts.sortOrder} DESC`).limit(1);
      const [part] = await tx.insert(frmFormParts).values({
        formPartUuid: uuidv4(), formUuid, formVersionUuid: fvUuid,
        partCode: input.part_code, partTitle: input.part_title,
        partType: "configurable", isOfficeOnly: input.is_office_only,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdByUuid: auditIdentity, updatedByUuid: auditIdentity,
        isDeleted: false, isSync: false,
      }).returning();
      return part;
    });
  },

  async rename(fvUuid: string, partUuid: string, title: string, actorId: number) {
    return getDb().transaction(async (tx: Executor) => {
      const { formUuid, auditIdentity } = await guardedVersion(tx, fvUuid, actorId);
      await activePart(tx, fvUuid, formUuid, partUuid);
      const [part] = await tx.update(frmFormParts).set({
        partTitle: title, updatedByUuid: auditIdentity, updatedAt: sql`now()`,
      }).where(eq(frmFormParts.formPartUuid, partUuid)).returning();
      return part;
    });
  },

  async reorder(fvUuid: string, partUuids: string[], actorId: number) {
    return getDb().transaction(async (tx: Executor) => {
      const { formUuid, auditIdentity } = await guardedVersion(tx, fvUuid, actorId);
      const existing = await tx.select().from(frmFormParts).where(and(
        eq(frmFormParts.formVersionUuid, fvUuid),
        eq(frmFormParts.formUuid, formUuid),
        eq(frmFormParts.isDeleted, false),
      ));
      const requested = new Set(partUuids);
      if (requested.size !== partUuids.length ||
        requested.size !== existing.length ||
        existing.some((part: typeof frmFormParts.$inferSelect) => !requested.has(part.formPartUuid))) {
        throw new FormPartError("Reorder must include every active version-owned part exactly once", 400);
      }
      for (const [index, partUuid] of partUuids.entries()) {
        await tx.update(frmFormParts).set({
          sortOrder: index, updatedByUuid: auditIdentity, updatedAt: sql`now()`,
        }).where(and(eq(frmFormParts.formVersionUuid, fvUuid), eq(frmFormParts.formPartUuid, partUuid)));
      }
      return tx.select().from(frmFormParts).where(and(
        eq(frmFormParts.formVersionUuid, fvUuid), eq(frmFormParts.isDeleted, false),
      )).orderBy(asc(frmFormParts.sortOrder), asc(frmFormParts.id));
    });
  },

  async remove(fvUuid: string, partUuid: string, actorId: number) {
    return getDb().transaction(async (tx: Executor) => {
      const { formUuid, auditIdentity } = await guardedVersion(tx, fvUuid, actorId);
      await activePart(tx, fvUuid, formUuid, partUuid);
      const [count] = await tx.select({ count: sql<number>`count(*)::int` }).from(frmSections).where(and(
        eq(frmSections.formVersionUuid, fvUuid),
        eq(frmSections.formPartUuid, partUuid),
        eq(frmSections.isDeleted, false),
      ));
      if (count.count > 0) {
        throw new FormPartError(`Cannot delete part: ${count.count} active section${count.count === 1 ? "" : "s"} reference it`, 409);
      }
      const [part] = await tx.update(frmFormParts).set({
        isDeleted: true, updatedByUuid: auditIdentity, updatedAt: sql`now()`,
      }).where(eq(frmFormParts.formPartUuid, partUuid)).returning();
      return part;
    });
  },
};