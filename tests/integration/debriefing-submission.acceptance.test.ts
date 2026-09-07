import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import type { Request } from "express";
import { debriefingService, DebriefingError } from "@server/v2/debriefings/service";
import { fileStorageService } from "@server/v2/shared/fileStorageService";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe.sequential("debriefing submission acceptance", () => {
  afterAll(async () => pool.end());

  it("pins an active G2's actual rank-group version and remains readable after G2 deletion", async () => {
    const client = await pool.connect();
    const ids = {
      crew: uuid(), g2: uuid(), unmatchedG2: uuid(), nullRankG2: uuid(), form: uuid(), group: uuid(), version: uuid(),
      newerVersion: uuid(), part: uuid(), applicable: uuid(), canonical: uuid(), restricted: uuid(),
      vessel: uuid(), vesselType: uuid(), office: uuid(), otherOffice: uuid(),
      question: uuid(),
    };
    let formId = 0;
    let groupId = 0;
    let officeId = 0;
    let otherOfficeId = 0;
    let submissionUuid: string | null = null;
    try {
      // Isolated master fixtures avoid reading or altering user configuration.
      const office = await client.query<{ id: number }>(
        `INSERT INTO master_users(user_uuid, fullname, user_type, designation, department)
         VALUES ($1, 'Debriefing Acceptance Office', 'office', 'Tester', 'Acceptance') RETURNING id`, [ids.office],
      );
      officeId = office.rows[0].id;
      const otherOffice = await client.query<{ id: number }>(
        `INSERT INTO master_users(user_uuid, fullname, user_type, designation, department)
         VALUES ($1, 'Debriefing Other Office', 'office', 'Tester', 'Other') RETURNING id`, [ids.otherOffice],
      );
      otherOfficeId = otherOffice.rows[0].id;
      await client.query(
        `INSERT INTO master_vessel_types(vt_uuid, vessel_type, is_active, is_deleted)
         VALUES ($1, 'Debriefing Acceptance Type', true, false)`, [ids.vesselType],
      );
      await client.query(
        `INSERT INTO master_vessels(vessel_uuid, vessel, vessel_type, is_active, is_deleted)
         VALUES ($1, 'Debriefing Acceptance Vessel', $2, true, false)`, [ids.vessel, ids.vesselType],
      );
      const req = { user: { id: officeId, domain: "integration", userType: "office" } } as Request;

      await client.query(
        `INSERT INTO crew_members_v2(crew_uuid, emp_no, first_name, family_name, is_active)
         VALUES ($1, $2, 'Debrief', 'Fixture', true)`,
        [ids.crew, `debrief-${ids.crew}`],
      );
      const insertedForm = await client.query<{ id: number }>(
        `INSERT INTO adm_forms_v2(form_uuid, name, category, rank_group, version_no, version_date, is_lock_form)
         VALUES ($1, $2, 'debriefing', 'DO NOT USE: acceptance fixture', '1', '01-Jan-2026', true)
         RETURNING id`,
        [ids.form, `Debriefing acceptance ${ids.form}`],
      );
      formId = insertedForm.rows[0].id;
      const insertedGroup = await client.query<{ id: number }>(
        `INSERT INTO adm_rank_groups_v2(rg_uuid, form_id, name, ranks)
         VALUES ($1, $2, 'Acceptance Deck', '["Acceptance Master"]') RETURNING id`,
        [ids.group, formId],
      );
      groupId = insertedGroup.rows[0].id;
      await client.query(
        `INSERT INTO adm_form_versions_v2(fv_uuid, form_id, rank_group_id, version_no, version_date, status)
         VALUES ($1, $2, $3, '1', '01-Jan-2026', 'released')`,
        [ids.version, formId, groupId],
      );
      await client.query(
        `INSERT INTO frm_form_parts(form_part_uuid, form_uuid, part_code, part_title, part_type)
         VALUES ($1, $2, 'B', 'Questions', 'configurable')`,
        [ids.part, ids.form],
      );
      await client.query(
        `INSERT INTO frm_sections(section_uuid, form_version_uuid, form_part_uuid, section_code, section_title, applicable_vessel_types, responsible_mode, responsible_department, signature_officer_required, signature_seafarer_required)
         VALUES ($1, $2, $3, 'B1', 'Applicable', '[]', 'department', 'Acceptance', true, true),
                ($4, $2, $3, 'B2', 'Canonical vessel type', $5, 'not_applicable', NULL, false, false),
                ($6, $2, $3, 'B3', 'Restricted', '["not-the-fixture-vessel-type"]', 'not_applicable', NULL, false, false)`,
        [ids.applicable, ids.version, ids.part, ids.canonical, JSON.stringify([ids.vesselType]), ids.restricted],
      );
      await client.query(
        `INSERT INTO frm_questions(question_uuid, section_uuid, question_code, question_text, response_type, is_mandatory)
         VALUES ($1, $2, 'B1Q1', 'Mandatory acceptance answer', 'free_text', true)`,
        [ids.question, ids.applicable],
      );
      await client.query(
        `INSERT INTO crew_debriefings(debriefing_uuid, crew_uuid, vessel_uuid, vessel_name, rank_served, date_sign_on, date_signed_off, reason_for_sign_off)
         VALUES ($1, $2, $3, 'Fixture vessel', 'Acceptance Master', '01-Jan-2026', '02-Feb-2026', 'Raw stored reason')`,
        [ids.g2, ids.crew, ids.vessel],
      );
      await client.query(
        `INSERT INTO crew_debriefings(debriefing_uuid, crew_uuid, vessel_uuid, rank_served)
         VALUES ($1, $2, $3, 'No Configured Rank'), ($4, $2, $3, NULL)`,
        [ids.unmatchedG2, ids.crew, ids.vessel, ids.nullRankG2],
      );

      await expect(debriefingService.resolveCreation({ debriefingUuid: ids.g2 }, req))
        .resolves.toMatchObject({ formUuid: ids.form, formVersionUuid: ids.version, rankGroupName: "Acceptance Deck" });
      await expect(debriefingService.resolveCreation({ debriefingUuid: ids.unmatchedG2 }, req))
        .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 404, message: expect.stringContaining("No Configured Rank") });
      await expect(debriefingService.resolveCreation({ debriefingUuid: ids.nullRankG2 }, req))
        .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 400, message: expect.stringContaining("no rank served") });
      const created = await debriefingService.create({ debriefingUuid: ids.g2 }, req);
      submissionUuid = created.debriefing_submission_uuid;
      await expect(debriefingService.create({ debriefingUuid: ids.g2 }, req))
        .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 409 });

      const states = await client.query<{ section_uuid: string; status: string; section_state_uuid: string }>(
        `SELECT section_uuid, status, section_state_uuid FROM frm_section_states WHERE submission_uuid = $1`, [submissionUuid],
      );
      expect(states.rows).toContainEqual(expect.objectContaining({ section_uuid: ids.applicable, status: "not_started" }));
      expect(states.rows).toContainEqual(expect.objectContaining({ section_uuid: ids.canonical, status: "not_started" }));
      expect(states.rows).toContainEqual(expect.objectContaining({ section_uuid: ids.restricted, status: "not_applicable" }));
      const applicableState = states.rows.find((state) => state.section_uuid === ids.applicable)!;
      const otherReq = { user: { id: otherOfficeId, domain: "integration", userType: "office" } } as Request;
      await expect(debriefingService.saveAnswers(submissionUuid, ids.applicable, [], undefined, otherReq))
        .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 403 });
      await expect(debriefingService.submit(submissionUuid, ids.applicable, undefined, req))
        .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 400, message: expect.stringContaining("Mandatory questions") });

      await client.query(
        `INSERT INTO frm_answers(answer_uuid, submission_uuid, question_uuid, answer_value)
         VALUES ($1, $2, $3, 'answered')`, [uuid(), submissionUuid, ids.question],
      );
      await expect(debriefingService.submit(submissionUuid, ids.applicable, undefined, req))
        .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 400, message: expect.stringContaining("officer signature") });
      const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5RwAAAABJRU5ErkJggg==";
      const firstOfficer = await debriefingService.uploadSignature(submissionUuid, ids.applicable, {
        type: "officer", data: png,
      }, req);
      const replacementOfficer = await debriefingService.uploadSignature(submissionUuid, ids.applicable, {
        type: "officer", data: png,
      }, req);
      expect(replacementOfficer).not.toBe(firstOfficer);
      const officerRows = await client.query<{ signature_att_uuid: string; signer_rank: string | null; signature_method: string }>(
        `SELECT signature_att_uuid, signer_rank, signature_method FROM frm_section_signatures
         WHERE section_state_uuid = $1 AND signature_type = 'officer'`, [applicableState.section_state_uuid],
      );
      expect(officerRows.rows).toEqual([{
        signature_att_uuid: replacementOfficer, signer_rank: null, signature_method: "officer",
      }]);
      await debriefingService.uploadSignature(submissionUuid, ids.applicable, {
        type: "seafarer", data: png, signerName: "Acceptance Seafarer", signerRank: "Acceptance Master",
      }, req);
      await debriefingService.deleteSignature(submissionUuid, ids.applicable, "seafarer", req);
      expect((await client.query(`SELECT 1 FROM frm_section_signatures WHERE section_state_uuid = $1 AND signature_type = 'seafarer'`, [applicableState.section_state_uuid])).rowCount).toBe(0);
      await debriefingService.uploadSignature(submissionUuid, ids.applicable, {
        type: "seafarer", data: png, signerName: "Acceptance Seafarer", signerRank: "Acceptance Master",
      }, req);
      await expect(debriefingService.submit(submissionUuid, ids.applicable, undefined, req))
        .resolves.toEqual({ missing_questions: [] });
      await expect(debriefingService.saveAnswers(submissionUuid, ids.applicable, [], undefined, req))
        .rejects.toMatchObject<Partial<DebriefingError>>({ statusCode: 409 });

      // A later release cannot affect the submission's pinned version.
      await client.query(
        `INSERT INTO adm_form_versions_v2(fv_uuid, form_id, rank_group_id, version_no, version_date, status)
         VALUES ($1, $2, $3, '2', '02-Jan-2026', 'released')`,
        [ids.newerVersion, formId, groupId],
      );
      const beforeDelete = await debriefingService.read(submissionUuid, req);
      expect(beforeDelete.submission.form_version_uuid).toBe(ids.version);
      expect(beforeDelete.partA.reason_for_sign_off).toBe("Raw stored reason");

      await client.query(`UPDATE crew_debriefings SET is_deleted = true WHERE debriefing_uuid = $1`, [ids.g2]);
      const afterDelete = await debriefingService.read(submissionUuid, req);
      expect(afterDelete.g2_data_available).toBe(false);
      expect(afterDelete.submission.debriefing_submission_uuid).toBe(submissionUuid);
      expect(afterDelete.partA.reason_for_sign_off).toBeNull();
    } finally {
      // Committed, unique fixtures are removed child-first even after failure.
      if (submissionUuid) {
        const attachmentRows = await client.query<{ signature_att_uuid: string; file_path: string }>(
          `SELECT ss.signature_att_uuid, a.file_path FROM frm_section_signatures ss
           JOIN frm_signature_attachments a ON a.sig_att_uuid = ss.signature_att_uuid
           WHERE ss.section_state_uuid IN
           (SELECT section_state_uuid FROM frm_section_states WHERE submission_uuid = $1)`, [submissionUuid],
        );
        await client.query(`DELETE FROM frm_section_signatures WHERE section_state_uuid IN (SELECT section_state_uuid FROM frm_section_states WHERE submission_uuid = $1)`, [submissionUuid]);
        if (attachmentRows.rows.length) await client.query(`DELETE FROM frm_signature_attachments WHERE sig_att_uuid = ANY($1::text[])`, [attachmentRows.rows.map((row) => row.signature_att_uuid)]);
        await Promise.all(attachmentRows.rows.map((row) => fileStorageService.deleteAttachment(row.file_path)));
        await client.query(`DELETE FROM frm_answers WHERE submission_uuid = $1`, [submissionUuid]);
        await client.query(`DELETE FROM frm_section_states WHERE submission_uuid = $1`, [submissionUuid]);
        await client.query(`DELETE FROM crew_debriefing_submissions WHERE debriefing_submission_uuid = $1`, [submissionUuid]);
      }
      await client.query(`DELETE FROM frm_questions WHERE question_uuid = $1`, [ids.question]);
      await client.query(`DELETE FROM frm_sections WHERE section_uuid = ANY($1::text[])`, [[ids.applicable, ids.canonical, ids.restricted]]);
      await client.query(`DELETE FROM frm_form_parts WHERE form_part_uuid = $1`, [ids.part]);
      await client.query(`DELETE FROM adm_form_versions_v2 WHERE fv_uuid = ANY($1::text[])`, [[ids.version, ids.newerVersion]]);
      if (groupId) await client.query(`DELETE FROM adm_rank_groups_v2 WHERE id = $1`, [groupId]);
      if (formId) await client.query(`DELETE FROM adm_forms_v2 WHERE id = $1`, [formId]);
      await client.query(`DELETE FROM crew_debriefings WHERE debriefing_uuid = ANY($1::text[])`, [[ids.g2, ids.unmatchedG2, ids.nullRankG2]]);
      await client.query(`DELETE FROM crew_members_v2 WHERE crew_uuid = $1`, [ids.crew]);
      await client.query(`DELETE FROM master_vessels WHERE vessel_uuid = $1`, [ids.vessel]);
      await client.query(`DELETE FROM master_vessel_types WHERE vt_uuid = $1`, [ids.vesselType]);
      if (officeId) await client.query(`DELETE FROM master_users WHERE id = $1`, [officeId]);
      if (otherOfficeId) await client.query(`DELETE FROM master_users WHERE id = $1`, [otherOfficeId]);
      client.release();
    }
  });
});