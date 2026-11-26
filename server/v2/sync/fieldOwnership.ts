// Who owns which field of a BOTH_EDITABLE table (decisions D1 and P0-1, 26 Nov 2026).
//
// When the ship and the office both changed the SAME field while out of contact,
// the owner of the field wins, not the later clock. A field with no owner falls
// back to "latest change wins" (Technical's rule). Only fields that can really be
// written by both sides need an entry.
//
// Rest Hours vessel record: the ship owns its review, the office owns its review
// and the lock. The counters are derived on each side and never logged.
//
// NC report (TO BE CONFIRMED by the owner, taken from the schema and the NC
// workflow): the ship creates and submits the report; the office fills root cause
// and actions, reviews and closes it. The two status fields move forward through
// one workflow (draft, vessel-submitted, office-submitted/Closed), and closing is
// the office's act, so the office owns them.

export type FieldOwner = "ship" | "office";

const OWNERS: Record<string, Record<string, FieldOwner>> = {
  rh_vessel_records_v2: {
    vessel_review_status: "ship",
    vessel_review_submitted_date: "ship",
    office_review_status: "office",
    office_review_submitted_date: "office",
    is_locked: "office",
  },
  rh_nc_reports_v2: {
    crew_member_id: "ship",
    vessel_id: "ship",
    rank: "ship",
    month_value: "ship",
    nc_reference: "ship",
    identified_root_cause: "office",
    immediate_corrective_action: "office",
    preventive_action: "office",
    preventive_action_status: "office",
    preventive_action_due_date: "office",
    preventive_action_date_completed: "office",
    office_closure_verified_by_name: "office",
    office_closure_verified_by_position: "office",
    office_closure_date: "office",
    status: "office",
    submission_status: "office",
  },
};

export function fieldOwner(table: string, field: string): FieldOwner | null {
  return OWNERS[table]?.[field] ?? null;
}

// Sender role from the instance id: a SHIP- prefix is a ship, anything else is the office.
export function roleOfInstance(instanceId: string): FieldOwner {
  return instanceId.toUpperCase().startsWith("SHIP-") ? "ship" : "office";
}

// The month column of each Rest Hours table that has one (the key of a month's
// data together with vessel_id), for recompute and the D3 reopen.
export const RH_MONTH_COLUMN: Record<string, string> = {
  rh_vessel_records_v2: "month_value",
  rh_crew_records_v2: "month_value",
  rh_daily_records_v2: "month_year",
  rh_vessel_violation_comments_v2: "month_value",
  rh_office_violation_comments_v2: "month_value",
  rh_nc_reports_v2: "month_value",
  rh_fixed_tasks_v2: "month_year",
  rh_variable_tasks_v2: "period_value",
  rh_dateline_adjustments_v2: "month_value",
};

// Ship-entered hours data. A late change to one of these on a month the office
// has locked reopens the month (D3). Crew records are derived, comments and NC
// reports are not hours.
export const RH_HOURS_TABLES = new Set([
  "rh_daily_records_v2",
  "rh_fixed_tasks_v2",
  "rh_variable_tasks_v2",
  "rh_dateline_adjustments_v2",
]);

// Tables whose derived totals must be recomputed after rows from the other side
// are applied (see rest-hours/utils/derivedTables.ts).
export const RH_RECOMPUTE_TABLES = new Set([
  "rh_daily_records_v2",
  "rh_fixed_tasks_v2",
  "rh_variable_tasks_v2",
  "rh_dateline_adjustments_v2",
  "rh_nc_reports_v2",
]);
