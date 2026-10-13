export type ListVersion = {
  id: number;
  formId: number;
  rankGroupId: number | null;
  versionNo: string;
  versionDate: string;
  status: string;
};

export type VersionLoadResult =
  | { state: "loaded"; versions: ListVersion[] }
  | { state: "error" | "loading" };

export function readListVersions(value: unknown): ListVersion[] {
  if (!Array.isArray(value) || value.some(version =>
    !version || !Number.isInteger(version.id) || !Number.isInteger(version.formId)
    || typeof version.versionNo !== "string" || typeof version.versionDate !== "string"
    || typeof version.status !== "string")) {
    throw new Error("The version list could not be loaded.");
  }
  return value;
}

// A released version remains the operative Standard version. If none exists,
// display the actual draft, never the legacy form mirror or a synthetic draft.
export function storedStandardVersion(versions: ListVersion[], rankGroupId: number | null) {
  const matching = versions.filter(version => version.rankGroupId === rankGroupId);
  const released = matching.filter(version => version.status === "released");
  return [...(released.length ? released : matching)].sort(
    (left, right) => Number(right.versionNo) - Number(left.versionNo) || right.id - left.id,
  )[0];
}
