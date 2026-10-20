import type { Request, RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { resolveRequestRole } from "../auth/roleResolutionService";
import { resolveTrustedVesselScope } from "../company-forms/trustedPrincipalService";

/** Identifiers below are code-owned, never interpolated from request data. */
export type AttachmentOwner = {
  table: string;
  key: string;
  parent: string;
  parentKey: string;
  menu: string;
  subject?: "candidate" | "vessel";
  subjectColumn?: string;
  crewKey?: "emp_no";
  via?: { table: string; key: string; parentKey: string };
};
export const crewAttachmentOwners: Record<string, AttachmentOwner> = {
  documents: { table: "crew_documents_attachments", key: "doc_uuid", parent: "crew_documents", parentKey: "doc_uuid", menu: "Crew Database" },
  visas: { table: "crew_visas_attachments", key: "visa_uuid", parent: "crew_visas", parentKey: "visa_uuid", menu: "Crew Database" },
  education: { table: "crew_education_attachments", key: "edu_uuid", parent: "crew_education", parentKey: "edu_uuid", menu: "Crew Database" },
  licenses: { table: "crew_licenses_attachments", key: "lic_uuid", parent: "crew_licenses", parentKey: "lic_uuid", menu: "Crew Database" },
  training: { table: "crew_training_attachments", key: "train_uuid", parent: "crew_training_courses", parentKey: "train_uuid", menu: "Crew Database" },
  "sea-service": { table: "crew_sea_service_attachments", key: "sea_uuid", parent: "crew_sea_service", parentKey: "sea_uuid", menu: "Crew Database" },
  medical: { table: "crew_medical_attachments", key: "med_uuid", parent: "crew_pre_joining_medicals", parentKey: "med_uuid", menu: "Crew Database" },
  "doctor-visits": { table: "crew_doctor_visits_attachments", key: "visit_uuid", parent: "crew_doctor_visits", parentKey: "visit_uuid", menu: "Crew Database" },
  briefing: { table: "crew_briefing_attachments", key: "briefing_uuid", parent: "crew_briefings", parentKey: "briefing_uuid", menu: "Crew Database" },
  debriefing: { table: "crew_debriefing_attachments", key: "debriefing_uuid", parent: "crew_debriefings", parentKey: "debriefing_uuid", menu: "Crew Database" },
};

export class AttachmentAccessError extends Error {
  constructor(public status: number) { super("This attachment is unavailable or you do not have permission to open it."); }
}
const identifier = (value: string) => {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error("Invalid attachment ownership configuration");
  return sql.raw(`"${value}"`);
};

/** The grant and category must resolve from persisted parent-role records. */
export async function authorizeAttachmentSubject(
  req: Request, menu: string, subject: string, kind: "crew" | "candidate" | "vessel" = "crew",
) {
  const resolution = await resolveRequestRole(req);
  if (!resolution.ok) throw new AttachmentAccessError(403);
  const role = resolution.role;
  const category = role.roleType.trim().toLowerCase();
  const actorType = role.masterUserType.trim().toLowerCase();
  const ship = ["ship", "vessel"].includes(category) && ["ship", "vessel"].includes(actorType);
  const office = ["office", "sail admin"].includes(category) && ["office", "sail admin"].includes(actorType);
  if (!ship && !office) throw new AttachmentAccessError(403);
  const db = getDb();
  const grants = (await db.execute(sql`SELECT g.canview FROM adm_roleaccess_ac g
    JOIN adm_menumaster_ac m ON m.muid=g.menu_id
    WHERE g.role_id=${role.roleId} AND NOT coalesce(g.is_deleted,false)
      AND m.is_active=true AND NOT coalesce(m.is_deleted,false)
      AND lower(btrim(m.name))=lower(${menu})`)).rows;
  if (grants.length !== 1 || grants[0].canview !== true) throw new AttachmentAccessError(403);
  if (kind === "candidate" && ship) throw new AttachmentAccessError(403);
  if (kind === "crew" || kind === "candidate") {
    const table = kind === "crew" ? "crew_members_v2" : "recruitment_candidates_v2";
    const key = kind === "crew" ? "crew_uuid" : "rec_can_uuid";
    const rows = (await db.execute(sql`SELECT 1 FROM ${identifier(table)}
      WHERE ${identifier(key)}=${subject} AND NOT coalesce(is_deleted,false)`)).rows;
    if (rows.length !== 1) throw new AttachmentAccessError(404);
  }
  if (!ship) return;
  const vessels = await resolveTrustedVesselScope(role.masterUserId);
  if (!vessels?.length) throw new AttachmentAccessError(403);
  if (kind === "vessel") {
    if (!vessels.includes(subject)) throw new AttachmentAccessError(403);
  } else {
    // Historical or cancelled assignments do not confer current onboard access.
    const allowed = (await db.execute(sql`SELECT 1 FROM crew_assignments
      WHERE crew_uuid=${subject} AND vessel_uuid IN (${sql.join(vessels.map(v => sql`${v}`), sql`,`)})
        AND NOT coalesce(is_deleted,false) AND is_current=true
        AND assignment_type='OnBoard' AND (sign_off_date IS NULL OR sign_off_date='')
      LIMIT 1`)).rows;
    if (!allowed.length) throw new AttachmentAccessError(403);
  }
}

export async function authorizeAttachment(req: Request, owner: AttachmentOwner, uuid: string, parentOnly = false) {
  const db = getDb();
  const column = owner.subjectColumn ?? (owner.subject === "candidate" ? "rec_can_uuid" : "crew_uuid");
  const rows = parentOnly
    ? (await db.execute(sql`SELECT p.${identifier(column)} AS subject FROM ${identifier(owner.parent)} p
        WHERE p.${identifier(owner.parentKey)}=${uuid} AND NOT coalesce(p.is_deleted,false)`)).rows
    : (await db.execute(sql`SELECT p.${identifier(column)} AS subject FROM ${identifier(owner.table)} a
        ${owner.via ? sql`JOIN ${identifier(owner.via.table)} v ON v.${identifier(owner.via.key)}=a.${identifier(owner.key)}` : sql``}
        JOIN ${identifier(owner.parent)} p ON p.${identifier(owner.parentKey)}=${owner.via
          ? sql`v.${identifier(owner.via.parentKey)}` : sql`a.${identifier(owner.key)}`}
        WHERE a.att_uuid=${uuid} AND NOT coalesce(a.is_deleted,false)
          AND NOT coalesce(p.is_deleted,false)
          ${owner.via ? sql`AND NOT coalesce(v.is_deleted,false)` : sql``}`)).rows;
  if (rows.length !== 1 || !rows[0].subject) throw new AttachmentAccessError(404);
  let subject = String(rows[0].subject);
  if (owner.crewKey) {
    const crew = (await db.execute(sql`SELECT crew_uuid FROM crew_members_v2
      WHERE emp_no=${subject} AND NOT coalesce(is_deleted,false)`)).rows;
    if (crew.length !== 1) throw new AttachmentAccessError(404);
    subject = String(crew[0].crew_uuid);
  }
  await authorizeAttachmentSubject(req, owner.menu, subject, owner.subject ?? "crew");
}

export function attachmentGuard(check: (req: Request) => Promise<void>): RequestHandler {
  return async (req, res, next) => {
    try {
      await check(req);
      res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      next();
    } catch (error) {
      if (!(error instanceof AttachmentAccessError)) console.error("[AttachmentAccess] check failed", error);
      res.status(error instanceof AttachmentAccessError ? error.status : 403).json({
        message: "This attachment is unavailable or you do not have permission to open it. Ask your administrator to check your access.",
      });
    }
  };
}

/** Also protects collection responses which contain legacy inline file data. */
export const crewAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method)) return;
  const raw = req.path.match(/^\/([^/]+)\/attachments\/([^/]+)\/raw\/?$/);
  const legacy = req.path.match(/^\/(briefing|debriefing)-attachments\/([^/]+)\/raw\/?$/);
  const match = raw ?? legacy;
  if (match && crewAttachmentOwners[match[1]]) {
    await authorizeAttachment(req, crewAttachmentOwners[match[1]], match[2]);
    return;
  }
  const list = req.path.match(/^\/crew\/([^/]+)\/(documents|visas|education|licenses|training|sea-service|medicals|doctor-visits|briefings|debriefings)(?:\/|$)/);
  if (list) await authorizeAttachmentSubject(req, "Crew Database", list[1]);
});
