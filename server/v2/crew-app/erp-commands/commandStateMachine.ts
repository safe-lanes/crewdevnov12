export const commandStatuses = [
  "queued", "leased", "applying", "verifying", "applied", "retryable",
  "reconciliation_required", "manual_reconciliation_required", "dead_letter", "blocked",
] as const;
export type CommandStatus = typeof commandStatuses[number];

const transitions: Record<CommandStatus, readonly CommandStatus[]> = {
  queued: ["leased", "blocked", "manual_reconciliation_required"],
  leased: ["applying", "retryable", "dead_letter", "blocked", "manual_reconciliation_required"],
  applying: ["verifying", "retryable", "reconciliation_required", "dead_letter"],
  verifying: ["applied", "retryable", "reconciliation_required", "dead_letter"],
  retryable: ["queued", "leased", "dead_letter"],
  reconciliation_required: ["verifying", "retryable", "applied", "dead_letter"],
  manual_reconciliation_required: ["applied", "dead_letter"],
  applied: [], blocked: [], dead_letter: [],
};

export function canTransition(from: CommandStatus, to: CommandStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: CommandStatus, to: CommandStatus): void {
  if (!canTransition(from, to)) throw new Error(`Invalid ERP command transition: ${from} -> ${to}`);
}
