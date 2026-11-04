import {
  attachmentConverterProfileSchema,
  type AttachmentConverterProfile,
  type AttachmentSectionId,
} from "./types";

/**
 * RSMS Profile A. The parser accepts an optional ZIP wrapper folder and then
 * expects: <Crew Name>/<Crew Name>. <Document Name>.pdf
 *
 * Category aliases are deliberately explicit. Adding a new alias is a
 * reviewed configuration change; no client-supplied expression is evaluated.
 */
const RSMS_PROFILE_A_INPUT = {
  profileId: "rsms-profile-a",
  name: "RSMS Crew Folder / Document Filename",
  version: "1.0.0",
  // Empty means the profile is available to the current tenant context. A
  // deployment may narrow this list to its tenant identifiers without code
  // changes.
  tenantScope: [],
  active: true,
  rootFolder: { mode: "optional-wrapper" as const },
  crewIdentification: { method: "folder-name" as const },
  folderParsing: { strategy: "crew-folder" as const },
  filenameParsing: {
    strategy: "rsms-crew-prefix-file" as const,
    separator: ". ",
  },
  documentCategory: {
    aliases: {
      training: ["training", "d3", "d3 training", "aff"],
    },
    resolution: "aliases-or-active-section" as const,
  },
  supportedFileTypes: ["application/pdf" as const],
  requiredValidation: {
    requireCrew: true,
    requireDocumentName: true,
    requireCategory: true,
    rejectUnsafePaths: true,
  },
  sections: {
    training: { active: true },
  },
};

export const RSMS_PROFILE_A: AttachmentConverterProfile =
  attachmentConverterProfileSchema.parse(RSMS_PROFILE_A_INPUT);

const PROFILE_REGISTRY: readonly AttachmentConverterProfile[] = [RSMS_PROFILE_A];

export function listAttachmentConverterProfiles(
  tenantId?: string | null,
): AttachmentConverterProfile[] {
  return PROFILE_REGISTRY.filter((profile) => {
    if (!profile.active) return false;
    if (!tenantId || profile.tenantScope.length === 0) return true;
    return profile.tenantScope.includes(tenantId);
  });
}

export function getAttachmentConverterProfile(
  profileId: string,
  tenantId?: string | null,
): AttachmentConverterProfile {
  const profile = listAttachmentConverterProfiles(tenantId).find(
    (candidate) => candidate.profileId === profileId,
  );
  if (!profile) {
    throw new Error(`Attachment converter profile "${profileId}" is not active or not available.`);
  }
  return profile;
}

export function validateAttachmentConverterProfile(
  profile: unknown,
): AttachmentConverterProfile {
  return attachmentConverterProfileSchema.parse(profile);
}

export function normalizeProfileAlias(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase();
}

export function categoryForDocumentName(
  profile: AttachmentConverterProfile,
  documentName: string,
): AttachmentSectionId | null {
  const normalizedDocumentName = normalizeProfileAlias(documentName);
  const matches = Object.entries(profile.documentCategory.aliases)
    .filter(([, aliases]) => aliases.some((alias) => normalizeProfileAlias(alias) === normalizedDocumentName))
    .map(([category]) => category);

  return matches.length === 1 && profile.sections[matches[0]]?.active
    ? matches[0]
    : null;
}
