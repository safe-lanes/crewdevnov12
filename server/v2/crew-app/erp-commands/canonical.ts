import { createHash } from "node:crypto";

function normalize(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(trimmed)) return trimmed.slice(0, 10);
    return trimmed;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, normalize(child)]));
  }
  return value;
}

export function canonicalApproved(payload: Record<string, unknown>): Record<string, unknown> {
  return normalize(payload) as Record<string, unknown>;
}

export function canonicalAuthoritative(
  authoritative: Record<string, unknown>, approved: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(Object.keys(approved).sort().map(key => [key, normalize(authoritative[key])]));
}

export function canonicalMatches(payload: Record<string, unknown>, authoritative: Record<string, unknown>): boolean {
  const approved = canonicalApproved(payload);
  return JSON.stringify(approved) === JSON.stringify(canonicalAuthoritative(authoritative, approved));
}

export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}
