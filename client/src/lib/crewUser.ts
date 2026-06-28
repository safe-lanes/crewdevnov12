// Shared accessor for the logged-in crew user id used to stamp audit columns
// (created_by_uuid / updated_by_uuid). The parent app (SAIL Audits) writes the
// logged-in user's id to sessionStorage under "crewUserId" as a plaintext UUID
// when entering the Crewing module. It is NOT encrypted, so it must be read
// directly (do not run it through the decrypt service). Returns null when absent.
export function getCrewUserId(): string | null {
  try {
    return sessionStorage.getItem("crewUserId") || null;
  } catch {
    return null;
  }
}
