import type { Catalogs } from "./contract";

export type CertificateCatalog = "licenses" | "training";
type Entry = Catalogs[string][number];

// The suffix distinguishes duplicate names without exposing internal row UUIDs.
export const certificateOption = (entry: Entry) => `${entry.label} [DB:${entry.value}]`;
const normalize = (value: string) => value.trim().toLowerCase();
const uniqueEntries = (entries: Entry[]) =>
  [...new Map(entries.map(entry => [JSON.stringify([entry.value, normalize(entry.label)]), entry])).values()];

export const PREVIOUS_CERTIFICATE_GUIDE = "Required in populated rows: document type; visa country/type; qualification; license/course; child first name; information.";
export const CERTIFICATE_GUIDE = `${PREVIOUS_CERTIFICATE_GUIDE} License/course: choose a database dropdown option or type a custom name.`;

export function resolveCertificate(input: string, entries: Entry[]):
  { name: string; id?: string; fingerprintName: string; error?: string } {
  const raw = input.trim();
  const encoded = /^(.*?)\s+\[DB:([^\]]+)\]$/i.exec(raw);
  const options = uniqueEntries(entries);
  if (/\[DB:/i.test(raw)) {
    const matches = encoded ? options.filter(entry => entry.value === encoded[2]) : [];
    if (matches.length !== 1 || normalize(matches[0].label) !== normalize(encoded![1])) {
      return { name: raw, fingerprintName: raw, error: "This database option is invalid, ambiguous or no longer available (it may have been renamed or deactivated). Download a fresh template and select the current option." };
    }
    const duplicateName = options.filter(entry => normalize(entry.label) === normalize(matches[0].label)).length > 1;
    return { name: matches[0].label, id: matches[0].value,
      fingerprintName: duplicateName ? certificateOption(matches[0]) : matches[0].label };
  }
  const matches = options.filter(entry => normalize(entry.label) === normalize(raw));
  if (matches.length > 1) {
    return { name: raw, fingerprintName: raw, error: "More than one database item has this name. Select the dropdown option with the correct database code." };
  }
  if (matches.length === 1) {
    // A business code reused for different names cannot identify a single master.
    if (options.filter(entry => entry.value === matches[0].value).length !== 1) {
      return { name: raw, fingerprintName: raw, error: "This database code is used by more than one item. Ask your administrator to correct the catalog before importing." };
    }
    // Keep the original typed spelling for compatibility with earlier imports.
    return { name: matches[0].label, id: matches[0].value, fingerprintName: raw };
  }
  return { name: raw, fingerprintName: raw };
}
