import { attachmentGuard, authorizeAttachment, type AttachmentOwner } from "./attachmentAccess";

export const planningAttachmentOwner: AttachmentOwner = {
  table: "vessel_planning_attachments_v2", key: "plan_uuid",
  parent: "vessel_planning_v2", parentKey: "plan_uuid",
  menu: "Planning", subject: "vessel", subjectColumn: "vessel_uuid",
};
export const planningAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method)) return;
  const raw = req.path.match(/^\/planning\/attachments\/([^/]+)\/raw\/?$/);
  if (raw) { await authorizeAttachment(req, planningAttachmentOwner, raw[1]); return; }
  const list = req.path.match(/^\/planning\/([^/]+)\/attachments\/?$/);
  if (list) await authorizeAttachment(req, planningAttachmentOwner, list[1], true);
});

export const drugAlcoholAttachmentOwner: AttachmentOwner = {
  table: "da_attachments_v2", key: "test_record_uuid",
  parent: "da_test_records_v2", parentKey: "da_uuid",
  menu: "Drugs Alcohol", subject: "vessel", subjectColumn: "vessel_id",
};
export const drugAlcoholAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method)) return;
  const raw = req.path.match(/^\/attachments\/([^/]+)\/raw\/?$/);
  if (raw) { await authorizeAttachment(req, drugAlcoholAttachmentOwner, raw[1]); return; }
  const list = req.path.match(/^\/attachments\/([^/]+)\/?$/);
  if (list) await authorizeAttachment(req, drugAlcoholAttachmentOwner, list[1], true);
});

export const promotionAttachmentOwner: AttachmentOwner = {
  table: "promo_checklist_attachments_v2", key: "checklist_progress_uuid",
  via: { table: "promo_checklist_progress_v2", key: "cp_uuid", parentKey: "review_uuid" },
  parent: "promotion_reviews_v2", parentKey: "review_uuid",
  menu: "Promotions", subjectColumn: "crew_member_id", crewKey: "emp_no",
};
export const promotionAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method)) return;
  const raw = req.path.match(/^\/attachments\/([^/]+)\/raw\/?$/);
  if (raw) await authorizeAttachment(req, promotionAttachmentOwner, raw[1]);
});
