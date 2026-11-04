import { z } from "zod";

/**
 * Only these named strategies may be executed by the converter. Profile data
 * describes how a known strategy is configured; it never contains code.
 */
export const parserStrategySchema = z.enum(["rsms-crew-prefix-file"]);
export type ParserStrategy = z.infer<typeof parserStrategySchema>;

export const rootFolderModeSchema = z.enum(["none", "optional-wrapper"]);
export type RootFolderMode = z.infer<typeof rootFolderModeSchema>;

export const sectionIdSchema = z.string().min(1);
export type AttachmentSectionId = z.infer<typeof sectionIdSchema>;

export const attachmentConverterProfileSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  tenantScope: z.array(z.string().min(1)).default([]),
  active: z.boolean(),
  rootFolder: z.object({
    mode: rootFolderModeSchema,
  }),
  crewIdentification: z.object({
    method: z.literal("folder-name"),
  }),
  folderParsing: z.object({
    strategy: z.literal("crew-folder"),
  }),
  filenameParsing: z.object({
    strategy: parserStrategySchema,
    separator: z.string().min(1).max(4),
  }),
  documentCategory: z.object({
    aliases: z.record(z.array(z.string().min(1))),
    resolution: z.enum(["aliases-only", "aliases-or-active-section"]),
  }),
  supportedFileTypes: z.array(z.enum(["application/pdf", "image/png", "image/jpeg"])).min(1),
  requiredValidation: z.object({
    requireCrew: z.boolean(),
    requireDocumentName: z.boolean(),
    requireCategory: z.boolean(),
    rejectUnsafePaths: z.boolean(),
  }),
  sections: z.record(sectionIdSchema, z.object({
    active: z.boolean(),
  })),
});

export type AttachmentConverterProfile = z.infer<
  typeof attachmentConverterProfileSchema
>;

export interface NormalizedAttachmentInput {
  originalFilePath: string;
  extractedCrewName: string | null;
  extractedEmployeeId: string | null;
  extractedDocumentName: string | null;
  detectedDocumentCategory: AttachmentSectionId | null;
  originalFilename: string;
}

export type ParseFailureCode =
  | "INVALID_PATH"
  | "UNSUPPORTED_FILE_TYPE"
  | "INVALID_FILENAME"
  | "MISSING_CREW"
  | "MISSING_DOCUMENT_NAME"
  | "UNKNOWN_CATEGORY";

export interface ParsedAttachment {
  input: NormalizedAttachmentInput | null;
  error?: {
    code: ParseFailureCode;
    reason: string;
  };
}

export interface CrewCandidate {
  crewUuid: string;
  employeeId: string;
  crewName: string;
}

export interface SectionRecordCandidate {
  section: AttachmentSectionId;
  recordUuid: string;
  crewUuid: string;
  documentName: string;
  attachmentRef: string;
  erpRecord: string;
}

export interface ResolutionOverride {
  sourcePath: string;
  crewUuid: string;
  recordUuid: string;
  section: AttachmentSectionId;
  attachmentRef: string;
}

export const resolutionOverrideSchema = z.object({
  sourcePath: z.string().min(1),
  crewUuid: z.string().min(1),
  recordUuid: z.string().min(1),
  section: sectionIdSchema,
  attachmentRef: z.string().min(1),
});

export const resolutionOverridesSchema = z.array(resolutionOverrideSchema).default([]);

export type ConversionStatus =
  | "converted"
  | "manual_review"
  | "skipped"
  | "failed";

export interface ConversionReportRow {
  sourceProfileId: string;
  sourceProfileVersion: string;
  originalFilePath: string;
  matchedCrew: string | null;
  employeeId: string | null;
  documentCategory: AttachmentSectionId | null;
  matchedErpRecord: string | null;
  actualAttachmentRef: string | null;
  convertedDestinationPath: string | null;
  status: ConversionStatus;
  reason: string | null;
}

export interface CandidatePreview {
  sourcePath: string;
  parsed: NormalizedAttachmentInput | null;
  crews: CrewCandidate[];
  records: SectionRecordCandidate[];
  status: ConversionStatus;
  reason: string | null;
}

export interface ConversionAnalysis {
  profile: Pick<AttachmentConverterProfile, "profileId" | "name" | "version">;
  files: CandidatePreview[];
  report: ConversionReportRow[];
}

export interface ConversionResult {
  profile: Pick<AttachmentConverterProfile, "profileId" | "name" | "version">;
  convertedZip: Buffer;
  report: ConversionReportRow[];
  convertedCount: number;
  skippedCount: number;
  manualReviewCount: number;
}

export interface ConverterProgress {
  completed: number;
  total: number;
  percent: number;
  stage: "analysis" | "conversion" | "packaging" | "complete";
}

export type ConverterProgressCallback = (progress: ConverterProgress) => void;
