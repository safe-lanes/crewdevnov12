/**
 * Violation Filtering Helper Functions for V2
 * 
 * Compliance Modes:
 * - Rest Mode (MLC Option 2): Shows violations A, C, E, F, G
 * - Work Mode (MLC Option 1): Shows violations B, D
 * - OPA Mode: Always shows violations I, H when enabled (additive to other modes)
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
): string[] {
  const codes: string[] = [];

  if (complianceMode === 'Rest') {
    codes.push('A', 'C', 'E', 'F', 'G');
  } else {
    codes.push('B', 'D');
  }

  if (opaMode) {
    codes.push('I', 'H');
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
  violations: string[],
  complianceMode: ComplianceMode,
  opaMode: boolean
): string[] {
  const visibleCodes = getVisibleViolationCodes(complianceMode, opaMode);
  return violations.filter(v => visibleCodes.includes(v));
}
