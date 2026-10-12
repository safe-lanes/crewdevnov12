import { randomUUID } from "node:crypto";

/** A failed optional Forms activation must not take down otherwise valid tenant operations. */
export async function deferFailedStageActivation(filename: string, client: any, error: unknown): Promise<boolean> {
  if (filename !== "0249_company_form_tenant_go_live.sql") return false;
  const reason = "Form-stage activation is incomplete. Manual starting remains available; the next tenant upgrade retries activation.";
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "upgrade_failure";
  await client.query(`INSERT INTO frm_stage_audit(audit_uuid,actor_uuid,event,evidence)
    VALUES($1,'tenant-upgrade','GO_LIVE_FAILED',$2::jsonb)`, [randomUUID(), JSON.stringify({ reason, code, migration: filename })]);
  return true; // No migration ledger entry: this tenant must retry its own check.
}
