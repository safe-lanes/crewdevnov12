import type { ApprovalCard, Scope } from "../../approval-engine";

/**
 * A Crewing approval card = the engine's card contract plus two optional host hooks used by
 * the notifier (emails and the in-app bell):
 *   describeSubject — the record's name, e.g. "Portage bill May 2026 — Vessel X"
 *   subjectLink     — the in-app path that opens the record, e.g. "/accounts/portage/<uuid>"
 */
export interface CrewingApprovalCard extends ApprovalCard {
  describeSubject?(scope: Scope, subjectRef: string): Promise<string>;
  subjectLink?(scope: Scope, subjectRef: string): Promise<string | null>;
}
