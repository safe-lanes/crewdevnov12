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
