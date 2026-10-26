// Deliberate retained MAIN-PREVIEW fixtures, not an automated test seed.
// Run once with --prepare; subsequent runs reuse every registered UUID.
import pg from "pg";
import fs from "node:fs/promises";
import crypto from "node:crypto";

if (!process.argv.includes("--prepare")) throw Error("Requires explicit --prepare.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const id = n => `a4200000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ownCrew = "a4120000-0000-4000-8000-000000000004";
const ownVessel = "a4120000-0000-4000-8000-000000000001";
const roleId = "a4120000-0000-4000-8000-000000000052";
const filePath = "main/attachment-ui-verification/slice1.png";
const png = await fs.readFile("generated-artifacts/attachment-display/fixture-d3-display.png");
const rows = [];
async function insert(table, key, number, values) {
  const record = { [key]: id(number), ...values, ...(table === "master_vessels" ? {} : { created_by_uuid: "3" }) };
  const before = (await db.query(`SELECT * FROM "${table}" WHERE "${key}"=$1`, [id(number)])).rows[0];
  if (before) {
    for (const [field, value] of Object.entries(values)) {
      const equal = before[field] === value || (field === "file_size" && Number(before[field]) === value);
      if (!equal && !(field.endsWith("_at") && before[field])) {
        throw Error(`Registered fixture mismatch: ${table}.${field}; will not overwrite.`);
      }
    }
    if (before.is_deleted) throw Error(`Registered fixture deleted: ${table}`);
  } else {
    const keys = Object.keys(record);
    await db.query(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(",")})
      VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(record));
  }
  rows.push({ table, key, uuid: id(number), reused: !!before });
}
const attachment = (fileName = "TEST-ONLY-slice1.png") => ({
  file_name: fileName, file_type: "image/png", file_size: png.length, file_path: filePath,
});
try {
  // Never run this against an empty/different database or a realistic subject.
  const existing = (await db.query(`SELECT crew_uuid,emp_no,present_rank,nationality_uuid
    FROM crew_members_v2 WHERE crew_uuid=$1 AND NOT is_deleted`, [ownCrew])).rows[0];
  if (existing?.emp_no !== "PDF-LAYOUT-412") throw Error("Registered preview fixture not found.");
  const vessel = (await db.query(`SELECT vessel FROM master_vessels
    WHERE vessel_uuid=$1 AND NOT is_deleted`, [ownVessel])).rows[0];
  if (!vessel?.vessel.startsWith("TEST ONLY")) throw Error("Fixture-only vessel not established.");
  const roleUsers = (await db.query(`SELECT id,fullname,role FROM master_users
    WHERE lower(trim(role)) IN ($1,'pdf layout review vessel')`, [roleId])).rows;
  if (roleUsers.length !== 1 || roleUsers[0].id !== 412002) {
    throw Error("Vessel role is not exclusively the registered fixture user; no grant allowed.");
  }
  const interview = (await db.query(`SELECT f.form_uuid,v.fv_uuid,s.section_uuid
    FROM adm_forms_v2 f JOIN adm_form_versions_v2 v ON v.form_id=f.id
    JOIN frm_sections s ON s.form_version_uuid=v.fv_uuid
    WHERE f.name='Crew Interview Form' AND v.status='released'
      AND s.signature_officer_required AND NOT f.is_deleted
      AND NOT v.is_deleted AND NOT s.is_deleted
    ORDER BY v.id DESC,s.sort_order LIMIT 1`)).rows[0];
  if (!interview) throw Error("No released Interview signature section; originals will not be edited.");
  const promotion = (await db.query(`SELECT p.section_id,p.assessment_point_id,
      r.form_version_id,r.form_version_uuid,r.promotion_to_rank
    FROM promo_checklist_progress_v2 p JOIN promotion_reviews_v2 r USING(review_uuid)
    WHERE NOT p.is_deleted AND NOT r.is_deleted AND r.form_version_uuid IS NOT NULL
    ORDER BY r.id DESC,p.id LIMIT 1`)).rows[0];
  if (!promotion) throw Error("No pinned Promotion checklist template; originals will not be edited.");
  await fs.mkdir(".private/main/attachment-ui-verification", { recursive: true });
  try {
    const stored = await fs.readFile(`.private/${filePath}`);
    if (!stored.equals(png)) throw Error("Existing fixture file differs; will not replace.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.writeFile(`.private/${filePath}`, png, { flag: "wx" });
  }
  await db.query("BEGIN");
  await insert("master_vessels", "vessel_uuid", 2, {
    vessel: "TEST ONLY attachment other vessel", is_active: true,
  });
  await insert("crew_members_v2", "crew_uuid", 1, {
    emp_no: "TEST-ATTACHMENT-OTHER", first_name: "TEST ONLY", family_name: "ATTACHMENT OTHER",
    present_rank: existing.present_rank, nationality_uuid: existing.nationality_uuid,
    status: "On Board", is_active: true, recruitment_date: "2026-10-20",
  });
  await insert("crew_assignments", "assign_uuid", 3, {
    crew_uuid: id(1), vessel_uuid: id(2), assignment_type: "OnBoard",
    is_current: true, sign_on_date: "2026-10-20",
  });
  for (const [crew, parent, att] of [[ownCrew, 10, 11], [id(1), 12, 13]]) {
    await insert("crew_documents", "doc_uuid", parent, {
      crew_uuid: crew, document_id: "TEST-ATTACHMENT-SLICE1",
      document_name: "TEST ONLY attachment verification document", number: "TEST ONLY",
    });
    await insert("crew_documents_attachments", "att_uuid", att, { doc_uuid: id(parent), ...attachment() });
  }
  await insert("crew_licenses", "lic_uuid", 20, {
    crew_uuid: ownCrew, license_id: "TEST-ATTACHMENT-SLICE1",
    certificate_document: "TEST ONLY attachment verification licence", certificate_no: "TEST ONLY",
  });
  await insert("crew_licenses_attachments", "att_uuid", 21, { lic_uuid: id(20), ...attachment() });
  await insert("crew_pre_joining_medicals", "med_uuid", 30, {
    crew_uuid: ownCrew, vessel_uuid: ownVessel, examination_date: "2026-10-20",
    clinic_hospital: "TEST ONLY - not a medical examination", fit_for_duty: "TEST ONLY",
  });
  await insert("crew_medical_attachments", "att_uuid", 31, { med_uuid: id(30), ...attachment() });
  await insert("recruitment_candidates_v2", "rec_can_uuid", 40, {
    file_no: "TEST-ATTACHMENT-SLICE1", first_name: "TEST ONLY", family_name: "ATTACHMENT CANDIDATE",
    present_rank: existing.present_rank, rank_applied_for: existing.present_rank,
    nationality_uuid: existing.nationality_uuid, status: "In Progress",
  });
  await insert("cand_documents", "doc_uuid", 41, {
    rec_can_uuid: id(40), document_id: "TEST-ATTACHMENT-SLICE1",
    document_name: "TEST ONLY candidate attachment", number: "TEST ONLY",
  });
  await insert("cand_documents_attachments", "att_uuid", 42, { doc_uuid: id(41), ...attachment() });
  await insert("screening_b1_initial", "b1_uuid", 43, { rec_can_uuid: id(40) });
  await insert("screening_b1_attachments", "att_uuid", 44, { b1_uuid: id(43), ...attachment() });
  await insert("screening_b6_interviews", "b6_uuid", 45, { rec_can_uuid: id(40) });
  await insert("screening_b6_interview_items", "int_uuid", 46, {
    b6_uuid: id(45), interview_date: "2026-10-20", interviewer_uuid: "3", status: "In Progress",
  });
  await insert("crew_interview_submissions", "interview_submission_uuid", 47, {
    rec_can_uuid: id(40), interview_item_uuid: id(46),
    form_uuid: interview.form_uuid, form_version_uuid: interview.fv_uuid, status: "in_progress",
  });
  await insert("frm_section_states", "section_state_uuid", 48, {
    submission_uuid: id(47), section_uuid: interview.section_uuid, status: "in_progress",
  });
  await insert("frm_signature_attachments", "sig_att_uuid", 50, attachment("TEST-ONLY-signature.png"));
  await insert("frm_section_signatures", "section_signature_uuid", 49, {
    section_state_uuid: id(48), signature_type: "officer", signature_att_uuid: id(50),
    signer_name: "TEST ONLY Fixture Officer", signer_rank: "Crewing Manager",
    signed_at: "2026-10-20T10:00:00Z", signed_by_uuid: "3", signature_method: "officer",
  });
  await insert("promotion_reviews_v2", "review_uuid", 60, {
    crew_member_id: "PDF-LAYOUT-412", promotion_to_rank: promotion.promotion_to_rank,
    status: "draft", form_version_id: promotion.form_version_id, form_version_uuid: promotion.form_version_uuid,
  });
  await insert("promo_checklist_progress_v2", "cp_uuid", 61, {
    review_uuid: id(60), section_id: promotion.section_id, assessment_point_id: promotion.assessment_point_id,
  });
  await insert("promo_checklist_attachments_v2", "att_uuid", 62, { checklist_progress_uuid: id(61), ...attachment() });
  await insert("da_test_records_v2", "da_uuid", 70, {
    vessel_id: ownVessel, test_type: "periodic", alcohol_drug_type: '["Alcohol"]',
    description: "TEST ONLY attachment display", status: "draft",
  });
  await insert("da_attachments_v2", "att_uuid", 71, { test_record_uuid: id(70), ...attachment() });
  await db.query("COMMIT");
  await fs.writeFile("generated-artifacts/attachment-display/prepared-fixtures.json", JSON.stringify({
    ownCrew, ownVessel, roleId, exclusiveRoleUsers: roleUsers.map(u => u.id),
    rows, interview, promotion, filePath,
    fileSha256: crypto.createHash("sha256").update(png).digest("hex"),
  }, null, 2));
  console.log(JSON.stringify({ exclusiveRoleUsers: roleUsers.map(u => u.id), rows, interview, promotion }, null, 2));
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await db.end();
}
