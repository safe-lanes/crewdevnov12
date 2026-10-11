import type { Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { admMenuMasterAc, admRoleMasterAc, admRoleAccessAc } from "../../../../shared/v2/admin/schema";
import { AccessControlError, appendAudit, managedWrite } from "./accessControlManagement";

const menuFields = z.object({ name: z.string().min(1), displayName: z.string().nullable().optional(),
  route: z.string().min(1), parentMenu: z.string().nullable().optional(), isActive: z.boolean().optional(),
  sortOrder: z.number().int().nullable().optional() }).strict();
// Categories, UUIDs, parent provenance, timestamps and ALL identity aliases are excluded.
const roleFields = z.object({ assignedRole: z.string().min(1), isActive: z.boolean().optional(),
  sortOrder: z.number().int().nullable().optional(), orderby: z.number().int().nullable().optional() }).strict();
const menuGrants = z.object({ permissions: z.array(z.object({
  menuId: z.string().min(1), canview: z.boolean(), cancreate: z.boolean(),
  canedit: z.boolean(), candelete: z.boolean(),
}).strict()).max(2000) }).strict();
const parse = (schema: z.ZodTypeAny, body: unknown) => {
  const result = schema.safeParse(body);
  if (!result.success) throw new AccessControlError("Invalid payload. Category, authority, audit identities and timestamps are server-owned.", 400);
  return result.data;
};
export async function writeCatalogue(req: Request, kind: "role" | "menu", operation: "create" | "update" | "delete", id?: string) {
  const fields = kind === "role" ? roleFields : menuFields;
  const data = operation === "delete" ? parse(z.object({}).strict(), req.body ?? {}) :
    parse(operation === "create" ? fields : fields.partial(), req.body);
  return managedWrite(req, async (tx, actor) => {
    const table = kind === "role" ? admRoleMasterAc : admMenuMasterAc;
    const key = kind === "role" ? admRoleMasterAc.ruid : admMenuMasterAc.muid;
    if (operation === "create") {
      const values = kind === "role" ? { ...data, ruid: randomUUID(), roletype: "Unclassified", parentOwned: false } :
        { ...data, muid: randomUUID() };
      const rows = await tx.insert(table).values({ ...values, createdByUuid: String(actor.masterUserId) }).returning();
      return rows[0];
    }
    const before = (await tx.select().from(table).where(and(eq(key, id!), eq(table.isDeleted, false))))[0];
    if (!before) throw new AccessControlError(`${kind} not found.`, 404);
    const values = operation === "delete" ? { isDeleted: true } : data;
    const rows = await tx.update(table).set({ ...values, updatedAt: sql`now()`,
      updatedByUuid: String(actor.masterUserId) }).where(eq(key, id!)).returning();
    // Eligibility changes are separately labelled, not fabricated grant revocations.
    if (kind === "role" && (before.isActive !== rows[0].isActive || before.isDeleted !== rows[0].isDeleted))
      await appendAudit(tx, actor, "role_eligibility_change", id!, "access_control", "role_eligibility",
        { isActive: before.isActive, isDeleted: before.isDeleted },
        { isActive: rows[0].isActive, isDeleted: rows[0].isDeleted });
    return operation === "delete" ? true : rows[0];
  });
}
export async function writeMenuGrants(req: Request, roleId: string) {
  const { permissions } = parse(menuGrants, req.body);
  if (new Set(permissions.map((p: any) => p.menuId)).size !== permissions.length)
    throw new AccessControlError("Duplicate menu grants.", 400);
  return managedWrite(req, async (tx, actor) => {
    const role = (await tx.select().from(admRoleMasterAc).where(and(eq(admRoleMasterAc.ruid, roleId),
      eq(admRoleMasterAc.isDeleted, false))))[0];
    if (!role) throw new AccessControlError("Role not found.", 404);
    const results = [];
    for (const p of permissions) {
      const menu = (await tx.select().from(admMenuMasterAc).where(and(eq(admMenuMasterAc.muid, p.menuId),
        eq(admMenuMasterAc.isDeleted, false))))[0];
      if (!menu) throw new AccessControlError("Menu not found.", 400);
      const before = (await tx.select().from(admRoleAccessAc).where(and(eq(admRoleAccessAc.roleId, roleId),
        eq(admRoleAccessAc.menuId, p.menuId), eq(admRoleAccessAc.isDeleted, false))))[0];
      const changes = ["canview", "cancreate", "canedit", "candelete"].filter(k => (before?.[k] ?? null) !== p[k]);
      if (!changes.length) { results.push(before); continue; }
      const values = { canview: p.canview, cancreate: p.cancreate, canedit: p.canedit, candelete: p.candelete,
        updatedByUuid: String(actor.masterUserId), updatedAt: sql`now()` };
      const rows = before ?
        await tx.update(admRoleAccessAc).set(values).where(eq(admRoleAccessAc.id, before.id)).returning() :
        await tx.insert(admRoleAccessAc).values({ ...values, roleId, menuId: p.menuId,
          rauid: randomUUID(), createdByUuid: String(actor.masterUserId) }).returning();
      for (const key of changes) await appendAudit(tx, actor, "grant_change", roleId, `menu:${p.menuId}`,
        key.slice(3), before?.[key] ?? null, p[key], { menuName: menu.name });
      results.push(rows[0]);
    }
    return results;
  });
}
