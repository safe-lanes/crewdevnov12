import { sql } from "drizzle-orm";
import { suggestionHistory, type Suggestion } from "./complianceSuggestions";

/** Subject authorization and Training/create are checked by the route first. */
export async function decideTrainingSuggestion(tx: any, uuid: string, action: "confirm" | "dismiss",
  actor: string, reason?: string): Promise<Suggestion> {
  if (!actor) throw Object.assign(new Error("Sign in again before changing this suggestion."), { status: 401 });
  if (action === "dismiss" && !reason?.trim())
    throw Object.assign(new Error("Write a reason before dismissing this suggestion."), { status: 400 });
  // Compatible assignment -> plan -> suggestion order with reconciliation.
  const row = (await tx.execute(sql`SELECT assign_uuid,plan_uuid FROM training_compliance_suggestions
    WHERE suggestion_uuid=${uuid}`)).rows[0];
  if (!row) throw Object.assign(new Error("This suggestion is no longer available. Reload and try again."), { status: 404 });
  await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${row.assign_uuid} FOR UPDATE`);
  await tx.execute(sql`SELECT plan_uuid FROM vessel_planning_v2 WHERE plan_uuid=${row.plan_uuid} FOR UPDATE`);
  const before = (await tx.execute(sql`SELECT * FROM training_compliance_suggestions
    WHERE suggestion_uuid=${uuid} FOR UPDATE`)).rows[0] as Suggestion;
  if (before.status !== "SUGGESTED")
    throw Object.assign(new Error("This suggestion has already changed. Reload to see its current status."), { status: 409 });
  const after = (await tx.execute(action === "confirm"
    ? sql`UPDATE training_compliance_suggestions SET status='CONFIRMED',confirmed_at=now(),
        confirmed_by=${actor},updated_at=now() WHERE suggestion_uuid=${uuid} RETURNING *`
    : sql`UPDATE training_compliance_suggestions SET status='DISMISSED',updated_at=now()
        WHERE suggestion_uuid=${uuid} RETURNING *`)).rows[0] as Suggestion;
  await suggestionHistory(tx, before, after, action === "confirm" ? "confirmed" : "dismissed",
    action === "confirm" ? "Confirmed into Training Needs." : reason!.trim(), actor);
  return after;
}
