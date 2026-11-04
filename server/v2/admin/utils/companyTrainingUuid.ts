import { createHash } from "crypto";

/**
 * A company training's ct_uuid, worked out from its code (company_id, e.g.
 * "SA001"), so the same course has the same id on the office and on every
 * vessel without copying the list between them.
 *
 * Name-based UUIDv8 as in RFC 9562 appendix B.2: SHA-256 of the namespace
 * bytes followed by the trimmed, upper-cased code in UTF-8, first 16 bytes,
 * version 8, variant 10. SHA-256 rather than uuid v5 (SHA-1) because
 * Postgres has sha256() built in, so migration 0274 computes the same value
 * without the uuid-ossp extension.
 *
 * Namespace = v5('safelanes.crewing.company_trainings', URL). Never change
 * the namespace or the method: stored references would stop matching.
 */
export const COMPANY_TRAINING_UUID_NAMESPACE = "702a098f-d905-565c-993b-336495209e5d";

export function companyTrainingUuid(code: string): string {
  const name = code.trim().toUpperCase();
  if (!name) throw new Error("A company training needs a code to get its id");
  return nameBasedUuidV8(COMPANY_TRAINING_UUID_NAMESPACE, name);
}

/** RFC 9562 appendix B.2 name-based UUIDv8 (SHA-256). */
export function nameBasedUuidV8(namespace: string, name: string): string {
  const bytes = createHash("sha256")
    .update(Buffer.from(namespace.replace(/-/g, ""), "hex"))
    .update(name, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
