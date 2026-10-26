export class CertificateOwnershipError extends Error {
  readonly code = "certificate_ownership_immutable";
  constructor(recordLabel = "Certificate") {
    super(`${recordLabel} ownership cannot be changed. Delete the ${recordLabel.toLowerCase()} and re-create it against the correct seafarer.`);
    this.name = "CertificateOwnershipError";
  }
}

/** Validate supplied ownership, then keep it out of every ordinary UPDATE. */
export function certificateUpdateFields<T extends object, K extends string = "crewUuid">(
  data: T,
  ownerUuid: string,
  ownerField: K = "crewUuid" as K,
  recordLabel = "Certificate",
): Omit<T, K> {
  if (Object.prototype.hasOwnProperty.call(data, ownerField)
    && (data as Record<string, unknown>)[ownerField] !== ownerUuid) {
    throw new CertificateOwnershipError(recordLabel);
  }
  const fields = { ...data };
  delete (fields as Record<string, unknown>)[ownerField];
  return fields as Omit<T, K>;
}
