import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { attachmentGuard, AttachmentAccessError, authorizeAttachmentMenu, authorizeAttachmentSubject } from "./attachmentAccess";
import { scopeAttachmentJson } from "./attachmentJsonAccess";

export const crewAggregateAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method) || !/^\/crew(?:\/enriched|\/details|\/reactivated)?\/?$/i.test(req.path)) return;
  const { ship } = await authorizeAttachmentMenu(req, "Crew Database");
  if (ship) scopeAttachmentJson(req.res!, row => authorizeAttachmentSubject(req, "Crew Database", row.crewUuid));
});

export const recruitmentAggregateAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method)) return;
  const { ship } = await authorizeAttachmentMenu(req, "Recruitment");
  if (ship) throw new AttachmentAccessError(403);
});

export const drugAlcoholAggregateAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method) || !/^\/test-records(?:\/|$)/i.test(req.path)) return;
  // Violation statistics contain no file bytes or attachment metadata.
  if (req.path.toLowerCase() === "/test-records/violations") return;
  await authorizeAttachmentMenu(req, "Drugs Alcohol");
  scopeAttachmentJson(req.res!, row => authorizeAttachmentSubject(req, "Drugs Alcohol", row.vesselId, "vessel"));
});

export const promotionAggregateAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method) || !/^\/reviews(?:\/|$)/i.test(req.path)) return;
  await authorizeAttachmentMenu(req, "Promotions");
  scopeAttachmentJson(req.res!, async row => {
    if (!row?.crewMemberId) throw new AttachmentAccessError(404);
    const rows = (await getDb().execute(sql`SELECT crew_uuid FROM crew_members_v2
      WHERE emp_no=${row.crewMemberId} AND NOT coalesce(is_deleted,false)`)).rows;
    if (rows.length !== 1) throw new AttachmentAccessError(404);
    await authorizeAttachmentSubject(req, "Promotions", rows[0].crew_uuid);
  });
});
