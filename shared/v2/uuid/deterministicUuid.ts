import { v5 as uuidv5 } from "uuid";

/**
 * Shared helpers for deterministic row ids (SYN-03).
 *
 * A row that has a natural key must get the same uuid on the office and on every
 * vessel, so a row both sides create on their own is one row after sync. Use
 * uuid v4 only for rows with no natural key.
 *
 * Never change a namespace, a tag, a part order or a name format: stored uuids
 * would stop matching. Each module keeps its own fixed namespace constant.
 */

/** A key part that may be empty (it is still trimmed and lower-cased). */
export type OptionalKeyPart = { optional: string | null | undefined };

function normalise(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Canonical form: uuid v5 over `part|part|...` under `ns`. Every part is
 * trimmed and lower-cased. An empty part throws, unless it is given as
 * `{ optional: value }`.
 */
export function deterministicUuid(ns: string, ...keyParts: Array<string | OptionalKeyPart>): string {
  const parts = keyParts.map((part, i) => {
    if (typeof part === "object" && part !== null) return normalise(part.optional);
    const v = normalise(part);
    if (!v) throw new Error(`Key part ${i + 1} is empty, so no deterministic uuid can be built`);
    return v;
  });
  return uuidv5(parts.join("|"), ns);
}

/**
 * Raw uuid v5 over a name the caller has already built. For modules whose
 * stored ids use their own name format (separator, case rules) and must stay
 * byte-identical.
 */
export function uuidV5Name(ns: string, name: string): string {
  return uuidv5(name, ns);
}
