/** Only persisted provenance and the authenticated user's trusted identity. */
export function ownsCompanyFormSignature(signature: { signedByUuid: string | null; witnessUserId?: number | null },
  actorId: number, actorUuid?: string | null): boolean {
  return signature.witnessUserId === actorId || signature.signedByUuid === String(actorId) ||
    (!!actorUuid && signature.signedByUuid === actorUuid);
}
