/**
 * Violation Filtering Helper Functions
 * 
 * Compliance Modes:
 * - Rest Mode (MLC Option 2): Shows violations 1, 2, 3, 4
 * - Work Mode (MLC Option 1): Shows violations 5, 6
 * - OPA Mode: Always shows violations 7, 8 when enabled (additive to other modes)
 */

export type ComplianceMode = 'Rest' | 'Work';

/**
 * Get visible violation codes based on compliance mode and OPA mode
 * 
 * @param complianceMode - 'Rest' or 'Work' mode
 * @param opaMode - Whether OPA 90 mode is enabled
 * @returns Array of violation codes that should be visible
 */
export function getVisibleViolationCodes(
  complianceMode: ComplianceMode,
  opaMode: boolean
): number[] {
  const codes: number[] = [];

  // Add codes based on compliance mode
  if (complianceMode === 'Rest') {
    codes.push(1, 2, 3, 4); // Rest mode violations
  } else {
    codes.push(5, 6); // Work mode violations
  }

  // Add OPA codes if OPA mode is enabled
  if (opaMode) {
    codes.push(7, 8);
  }

  return codes;
}

/**
 * Filter violations array to only include visible codes
 * 
 * @param violations - Array of violation codes
 * @param complianceMode - 'Rest' or 'Work' mode
 * @param opaMode - Whether OPA 90 mode is enabled
 * @returns Filtered array of violation codes
 */
export function filterViolations(
  violations: number[],
  complianceMode: ComplianceMode,
  opaMode: boolean
): number[] {
  const visibleCodes = getVisibleViolationCodes(complianceMode, opaMode);
  return violations.filter(v => visibleCodes.includes(v));
}
