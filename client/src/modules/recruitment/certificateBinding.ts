// Historical LIC-/TRN- row numbers are not master references. Manual rows have
// no master ID, even when an abbreviation or requirement has been entered.
export function hasCertificateDatabaseId(id: string | null | undefined, kind: "license" | "training"): boolean {
  return Boolean(id?.trim() && !(kind === "license" ? /^LIC-\d+$/ : /^TRN-\d+$/).test(id));
}
