import { attachmentGuard, authorizeAttachment, authorizeAttachmentSubject, type AttachmentOwner } from "./attachmentAccess";

const candidate = (table: string, parent: string, key: string): AttachmentOwner => ({
  table, parent, key, parentKey: key, menu: "Recruitment", subject: "candidate",
});
export const recruitmentAttachmentOwners: Record<string, AttachmentOwner> = {
  documents: candidate("cand_documents_attachments", "cand_documents", "doc_uuid"),
  visas: candidate("cand_visas_attachments", "cand_visas", "visa_uuid"),
  education: candidate("cand_education_attachments", "cand_education", "edu_uuid"),
  licenses: candidate("cand_licenses_attachments", "cand_licenses", "lic_uuid"),
  training: candidate("cand_training_attachments", "cand_training_courses", "train_uuid"),
  "sea-service": candidate("cand_sea_service_attachments", "cand_sea_service", "sea_uuid"),
  "additional-info": candidate("cand_additional_info_attachments", "cand_additional_info", "info_uuid"),
  "screening/b1": candidate("screening_b1_attachments", "screening_b1_initial", "b1_uuid"),
  "screening/b2": candidate("screening_b2_attachments", "screening_b2_references", "b2_uuid"),
  "screening/b3": candidate("screening_b3_attachments", "screening_b3_security", "b3_uuid"),
  "screening/b4": candidate("screening_b4_attachments", "screening_b4_certificates", "b4_uuid"),
  "screening/b5": candidate("screening_b5_attachments", "screening_b5_tests", "b5_uuid"),
  "screening/b6": candidate("screening_b6_attachments", "screening_b6_interviews", "b6_uuid"),
  "screening/b8": candidate("screening_b8_attachments", "screening_b8_shortlisting", "b8_uuid"),
};
export const recruitmentAttachmentAccess = attachmentGuard(async req => {
  if (!["GET", "HEAD"].includes(req.method)) return;
  const raw = req.path.match(/^\/(.+)\/attachments\/([^/]+)\/raw\/?$/);
  if (raw && recruitmentAttachmentOwners[raw[1]]) {
    await authorizeAttachment(req, recruitmentAttachmentOwners[raw[1]], raw[2]);
    return;
  }
  const attachments = req.path.match(/^\/(.+)\/([^/]+)\/attachments\/?$/);
  if (attachments && recruitmentAttachmentOwners[attachments[1]]) {
    await authorizeAttachment(req, recruitmentAttachmentOwners[attachments[1]], attachments[2], true);
    return;
  }
  const candidateList = req.path.match(/^\/candidates\/([^/]+)\/(documents|visas|education|licenses|training|sea-service|additional-info)(?:\/|$)/);
  if (candidateList) await authorizeAttachmentSubject(req, "Recruitment", candidateList[1], "candidate");
  const screening = req.path.match(/^\/(screening\/b[1-6]|screening\/b8)\/([^/]+)\/?$/);
  if (screening) await authorizeAttachment(req, recruitmentAttachmentOwners[screening[1]], screening[2], true);
});
