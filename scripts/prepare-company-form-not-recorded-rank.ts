/** Retained test-owned forms and assignments; never deletes or resets fixtures. */
import fs from "node:fs/promises";
import { createRequirementFixture, requirementPool } from "../tests/helpers/company-form-requirement-fixtures";
import { retainFixtureReferences } from "../tests/helpers/fixture-retention";
async function main() {
  if (process.env.NODE_ENV === "production") throw Error("Development fixture harness only");
  const dir = ".local/verification/not-recorded-rank";
  await fs.mkdir(dir, { recursive: true });
  const previous = await fs.readFile(`${dir}/fixtures.json`, "utf8").then(JSON.parse).catch(error => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const fixture of previous) {
    const graph = (await requirementPool.query(`SELECT jsonb_build_object(
      'assignment',s.subject_ref,'submission',s.submission_uuid,'signature',g.section_signature_uuid,
      'attachment',g.signature_att_uuid,'snapshot',ss.snapshot_uuid,'state',st.section_state_uuid) AS refs
      FROM frm_company_submissions s LEFT JOIN frm_section_states st USING(submission_uuid)
      LEFT JOIN frm_section_signatures g USING(section_state_uuid)
      LEFT JOIN frm_company_submission_system_snapshots ss USING(submission_uuid)
      WHERE s.subject_ref=$1`, [fixture.assignment])).rows;
    retainFixtureReferences("retained earlier main-preview signing attempts", graph.map(row => row.refs));
  }
  if (process.argv.includes("--register-only")) return;
  const fixtures = [];
  for (const missing of [true, false]) {
    const f = await createRequirementFixture("before_joining", {
      signatures: true, rankSystemField: true, unresolvedContractRank: missing,
    });
    // Deliberately different mutable profile data must never supply this rank.
    await requirementPool.query("UPDATE crew_members_v2 SET present_rank='TEST ONLY MUTABLE PROFILE RANK' WHERE crew_uuid=$1", [f.crewUuid]);
    await f.record(`main-preview-${missing ? "missing" : "captured"}-rank`, [{
      formVersionUuid: f.version.fvUuid, status: "OUTSTANDING", matchedSetUuids: f.matchedSetUuids, values: {},
    }]);
    const requirement = (await requirementPool.query("SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1", [f.assignUuid])).rows[0].requirement_uuid;
    const form = (await requirementPool.query("SELECT name FROM adm_forms_v2 WHERE id=$1", [f.formId])).rows[0];
    const question = (await requirementPool.query("SELECT question_uuid FROM frm_questions WHERE section_uuid=$1 AND system_field_key='rank'", [f.section])).rows[0];
    retainFixtureReferences("main preview missing/captured rank roots", [f.crewUuid, f.assignUuid, f.section, question.question_uuid, requirement]);
    fixtures.push({ missing, crew: f.crewUuid, assignment: f.assignUuid, section: f.section,
      rankQuestion: question.question_uuid, requirement, formName: form.name,
      expectedRank: missing ? "Not recorded" : f.rank.name, capturedRankUuid: f.rank.ar_uuid });
  }
  await fs.writeFile(`${dir}/fixtures.json`, JSON.stringify(fixtures, null, 2));
}
main().then(() => requirementPool.end()).then(() => process.exit(0)).catch(error => {
  console.error(error); process.exit(1);
});
