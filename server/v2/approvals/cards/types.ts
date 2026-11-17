import type { ApprovalCard, Scope } from "../../approval-engine";

/**
 * A Crewing approval card = the engine's card contract plus one optional host hook used by the
 * notifier to name the record in emails ("Portage bill May 2026 — Vessel X").
 */
export interface CrewingApprovalCard extends ApprovalCard {
  describeSubject?(scope: Scope, subjectRef: string): Promise<string>;
}
