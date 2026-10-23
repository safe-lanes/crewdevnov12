export class CertificateOwnershipError extends Error {
  readonly code = "certificate_ownership_immutable";
  constructor() {
    super("Certificate ownership cannot be changed. Delete the certificate and re-create it against the correct seafarer.");
    this.name = "CertificateOwnershipError";
  }
}

/** Validate supplied ownership, then keep it out of every ordinary UPDATE. */
export function certificateUpdateFields<T extends { crewUuid?: unknown }>(
  data: T,
  ownerUuid: string,
): Omit<T, "crewUuid"> {
  if (Object.prototype.hasOwnProperty.call(data, "crewUuid") && data.crewUuid !== ownerUuid) {
    throw new CertificateOwnershipError();
  }
  const { crewUuid: _owner, ...fields } = data;
  return fields;
}
