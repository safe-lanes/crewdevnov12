import { format, parseISO } from "date-fns";

/**
 * Rotation's picker keeps instants in local UI state. Persist joining as the
 * calendar day shown by that picker, not UTC midnight (which can change the day).
 * Normalize only at an explicit Save/Propose boundary; never repair data on read.
 */
export function rotationAssignmentsForSave<T extends { joiningDate: string }>(
  assignments: readonly T[],
): T[] {
  return assignments.map(assignment => ({
    ...assignment,
    joiningDate: format(parseISO(assignment.joiningDate), "yyyy-MM-dd"),
  }));
}
