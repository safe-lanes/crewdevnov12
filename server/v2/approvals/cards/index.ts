/**
 * The Crewing approval cards registered with the engine.
 *
 * To add a flow: write its card next to this file (start from sampleCard.ts), then add it to
 * the list below. A card that fails the engine's checks stops the server from starting, so a
 * broken card is caught at boot, not in production use.
 */
import type { CrewingApprovalCard } from "./types";
import { sampleApprovalCard } from "./sampleCard";

export function crewingApprovalCards(): CrewingApprovalCard[] {
  const cards: CrewingApprovalCard[] = [
    // Real flows go here, e.g. portageApprovalCard, promotionsApprovalCard.
  ];
  // Test-only template card: never registered unless explicitly switched on.
  if ((process.env.APPROVAL_ENGINE_SAMPLE_CARD ?? "").trim().toLowerCase() === "true") {
    cards.push(sampleApprovalCard);
  }
  return cards;
}
