export function canAccessTemporaryBriefings(userType: string | null | undefined): boolean {
  return userType?.trim().toLowerCase() === "office";
}