import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { incompleteTrainingCheck } from "./calculator";
import { readRelieverTrainingCompliance } from "./service";
import { readCanonicalReliever, readSavedTrainingMatrix, readTrainingCertificates } from "./reader";
import { trainingChecklistPolicy } from "./checklistPolicy";

/** Use the already locked Planning transaction, not a second connection. */
export async function trainingChecklistEvidence(tx: any, planUuid: string, assignmentUuid: string) {
  const setting = (await tx.execute(sql`SELECT block_expiring_during_contract FROM adm_training_compliance_settings
    WHERE singleton FOR SHARE`)).rows[0];
  if (!setting) throw new Error("Training settings upgrade required.");
  let check, canonical = null, matrix = null, certificates: unknown[] = [], header = null;
  await tx.execute(sql`SAVEPOINT training_check`);
  try {
    // Pin evidence against concurrent D3/master/revision changes for the rest
    // of this acceptance transaction. Identity and assignment were locked first.
    await tx.execute(sql`SELECT train_uuid FROM crew_training_courses WHERE crew_uuid=(
      SELECT crew_uuid FROM crew_assignments WHERE assign_uuid=${assignmentUuid}) FOR SHARE`);
    await tx.execute(sql`SELECT assign_uuid FROM crew_assignment_rule_context WHERE assign_uuid=${assignmentUuid} FOR SHARE`);
    await tx.execute(sql`SELECT id FROM adm_available_ranks_v2 FOR SHARE`);
    await tx.execute(sql`SELECT id FROM adm_company_trainings_v2 FOR SHARE`);
    await tx.execute(sql`SELECT id FROM adm_training_master_v2 FOR SHARE`);
    await tx.execute(sql`SELECT ctr_uuid FROM adm_company_training_requirements_v2 FOR SHARE`);
    await tx.execute(sql`SELECT tmvr_uuid FROM adm_training_matrix_vessel_revisions_v2 FOR SHARE`);
    check = await readRelieverTrainingCompliance(tx, { planUuid, assignmentUuid });
    canonical = await readCanonicalReliever(tx, { planUuid, assignmentUuid });
    if (canonical) {
      header = (await tx.execute(sql`SELECT
        btrim(concat_ws(' ',c.first_name,nullif(c.middle_name,''),c.family_name)) AS "crewName",
        v.vessel AS "vesselName",
        CASE WHEN x.contract_rank_uuid IS NULL THEN 'Not recorded'
          ELSE coalesce(nullif(x.contract_rank_label,''),'Not recorded') END AS "contractRankLabel"
        FROM crew_assignments a JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid
        JOIN master_vessels v ON v.vessel_uuid=a.vessel_uuid
        LEFT JOIN crew_assignment_rule_context x ON x.assign_uuid=a.assign_uuid
        WHERE a.assign_uuid=${assignmentUuid}`)).rows[0] ?? null;
      matrix = (await readSavedTrainingMatrix(tx, canonical)).matrix;
      certificates = await readTrainingCertificates(tx, canonical.crewUuid);
    }
    await tx.execute(sql`RELEASE SAVEPOINT training_check`);
  } catch {
    await tx.execute(sql`ROLLBACK TO SAVEPOINT training_check`);
    await tx.execute(sql`RELEASE SAVEPOINT training_check`);
    check = incompleteTrainingCheck({ assignmentUuid, vesselUuid: null }, [{
      code: "CALCULATION_FAILED", message: "The training check could not finish. Retry it; if it fails again, contact your office." }]);
  }
  const blockExpiringDuringContract = setting.block_expiring_during_contract === true;
  return { check, canonical, matrix, certificates, header, blockExpiringDuringContract,
    ...trainingChecklistPolicy(check, blockExpiringDuringContract) };
}

export async function recordTrainingAcceptance(tx: any, planUuid: string, assignmentUuid: string,
  actor: unknown, evidence: unknown) {
  const snapshotUuid = randomUUID(), text = JSON.stringify(evidence);
  const fingerprint = createHash("sha256").update(text).digest("hex");
  const row = (await tx.execute(sql`INSERT INTO training_checklist_snapshots
    (snapshot_uuid,plan_uuid,assignment_uuid,actor,evidence,evidence_sha256)
    VALUES (${snapshotUuid},${planUuid},${assignmentUuid},${JSON.stringify(actor)}::jsonb,${text}::jsonb,${fingerprint})
    RETURNING recorded_at`)).rows[0];
  await tx.execute(sql`SELECT set_config('sail.training_verified_plan',${planUuid},true)`);
  return { snapshotUuid, recordedAt: row.recorded_at, fingerprint };
}
