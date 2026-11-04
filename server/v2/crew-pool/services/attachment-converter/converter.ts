import JSZip, { type JSZipObject } from "jszip";
import {
  fileStorageService,
  AttachmentValidationError,
} from "../../../shared/fileStorageService.js";
import type {
  AttachmentConverterProfile,
  CandidatePreview,
  ConversionAnalysis,
  ConversionReportRow,
  ConversionResult,
  CrewCandidate,
  NormalizedAttachmentInput,
  ResolutionOverride,
  SectionRecordCandidate,
  ConverterProgressCallback,
} from "./types";
import type { AttachmentConverterResolvers } from "./resolvers";
import { parseAttachmentPath } from "./parser";

function profileSummary(profile: AttachmentConverterProfile) {
  return {
    profileId: profile.profileId,
    name: profile.name,
    version: profile.version,
  };
}

function emptyReport(
  profile: AttachmentConverterProfile,
  sourcePath: string,
): ConversionReportRow {
  return {
    sourceProfileId: profile.profileId,
    sourceProfileVersion: profile.version,
    originalFilePath: sourcePath,
    matchedCrew: null,
    employeeId: null,
    documentCategory: null,
    matchedErpRecord: null,
    actualAttachmentRef: null,
    convertedDestinationPath: null,
    status: "skipped",
    reason: null,
  };
}

function outputSegment(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[\\/\0]/.test(trimmed)) return null;
  return trimmed;
}

function sortedFiles(zip: JSZip): JSZipObject[] {
  return Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function indexOverride(
  overrides: ResolutionOverride[] | undefined,
): Map<string, ResolutionOverride> {
  const indexed = new Map<string, ResolutionOverride>();
  for (const override of overrides ?? []) {
    if (!indexed.has(override.sourcePath)) indexed.set(override.sourcePath, override);
  }
  return indexed;
}

interface ResolvedInput {
  input: NormalizedAttachmentInput | null;
  crew: CrewCandidate | null;
  record: SectionRecordCandidate | null;
  crewCandidates: CrewCandidate[];
  recordCandidates: SectionRecordCandidate[];
  status: CandidatePreview["status"];
  reason: string | null;
  parsedError?: string;
}

async function resolveInput(
  profile: AttachmentConverterProfile,
  sourcePath: string,
  resolvers: AttachmentConverterResolvers,
  overrides: Map<string, ResolutionOverride>,
): Promise<ResolvedInput> {
  const parsed = parseAttachmentPath(profile, sourcePath);
  if (!parsed.input) {
    return {
      input: null,
      crew: null,
      record: null,
      crewCandidates: [],
      recordCandidates: [],
      status: "skipped",
      reason: parsed.error?.reason ?? "File could not be parsed.",
      parsedError: parsed.error?.reason,
    };
  }

  const input = parsed.input;
  const crewCandidates = await resolvers.findCrewsByName(input.extractedCrewName ?? "");
  const override = overrides.get(sourcePath);

  if (override) {
    if (!profile.sections[override.section]?.active) {
      return {
        input,
        crew: null,
        record: null,
        crewCandidates,
        recordCandidates: [],
        status: "manual_review",
        reason: `Section "${override.section}" is not active for profile ${profile.profileId}.`,
      };
    }
    const crew = crewCandidates.find((candidate) => candidate.crewUuid === override.crewUuid) ?? null;
    if (!crew) {
      return {
        input,
        crew: null,
        record: null,
        crewCandidates,
        recordCandidates: [],
        status: "manual_review",
        reason: "The manual crew resolution does not match the crew name parsed from the source path.",
      };
    }
    const record = await resolvers.findRecordByUuid(override.section, crew.crewUuid, override.recordUuid);
    if (!record || record.attachmentRef !== override.attachmentRef) {
      return {
        input,
        crew,
        record: null,
        crewCandidates,
        recordCandidates: [],
        status: "manual_review",
        reason: "The manual record resolution is stale or its Attachment Ref is not the exact current database value.",
      };
    }
    return { input: { ...input, detectedDocumentCategory: override.section }, crew, record, crewCandidates, recordCandidates: [record], status: "converted", reason: null };
  }

  if (crewCandidates.length === 0) {
    return {
      input,
      crew: null,
      record: null,
      crewCandidates,
      recordCandidates: [],
      status: "skipped",
      reason: `No crew matched "${input.extractedCrewName}".`,
    };
  }
  if (crewCandidates.length > 1) {
    return {
      input,
      crew: null,
      record: null,
      crewCandidates,
      recordCandidates: [],
      status: "manual_review",
      reason: `Crew name "${input.extractedCrewName}" matches multiple SAIL crew records.`,
    };
  }
  const crew = crewCandidates[0];

  if (!input.detectedDocumentCategory) {
    if (profile.documentCategory.resolution === "aliases-or-active-section") {
      const activeSections = Object.entries(profile.sections)
        .filter(([, section]) => section.active)
        .map(([section]) => section);
      const sectionMatches: SectionRecordCandidate[] = [];
      for (const section of activeSections) {
        sectionMatches.push(
          ...(await resolvers.findRecords(
            section,
            crew.crewUuid,
            input.extractedDocumentName ?? "",
          )),
        );
      }
      if (sectionMatches.length === 1) {
        return {
          input: { ...input, detectedDocumentCategory: sectionMatches[0].section },
          crew,
          record: sectionMatches[0],
          crewCandidates,
          recordCandidates: sectionMatches,
          status: "converted",
          reason: null,
        };
      }
      if (sectionMatches.length > 1) {
        return {
          input,
          crew,
          record: null,
          crewCandidates,
          recordCandidates: sectionMatches,
          status: "manual_review",
          reason: `Document name "${input.extractedDocumentName}" matches multiple active ERP records; category and record require review.`,
        };
      }
      return {
        input,
        crew,
        record: null,
        crewCandidates,
        recordCandidates: [],
        status: "skipped",
        reason: `No active section record matched document name "${input.extractedDocumentName}".`,
      };
    }
    return {
      input,
      crew,
      record: null,
      crewCandidates,
      recordCandidates: [],
      status: "manual_review",
      reason: parsed.error?.reason ?? "Document category is not an approved profile alias.",
    };
  }
  if (!profile.sections[input.detectedDocumentCategory]?.active) {
    return {
      input,
      crew,
      record: null,
      crewCandidates,
      recordCandidates: [],
      status: "skipped",
      reason: `Document category "${input.detectedDocumentCategory}" is not active for this profile.`,
    };
  }

  const records = await resolvers.findRecords(
    input.detectedDocumentCategory,
    crew.crewUuid,
    input.extractedDocumentName ?? "",
  );
  if (records.length === 0) {
    return {
      input,
      crew,
      record: null,
      crewCandidates,
      recordCandidates: records,
      status: "skipped",
      reason: `No ${input.detectedDocumentCategory} ERP record matched document name "${input.extractedDocumentName}".`,
    };
  }
  if (records.length > 1) {
    return {
      input,
      crew,
      record: null,
      crewCandidates,
      recordCandidates: records,
      status: "manual_review",
      reason: `Document name "${input.extractedDocumentName}" matches multiple ERP records.`,
    };
  }

  return { input, crew, record: records[0], crewCandidates, recordCandidates: records, status: "converted", reason: null };
}

function reportForResolved(
  profile: AttachmentConverterProfile,
  sourcePath: string,
  resolved: ResolvedInput,
  destinationPath: string | null,
): ConversionReportRow {
  return {
    ...emptyReport(profile, sourcePath),
    matchedCrew: resolved.crew?.crewName ?? null,
    employeeId: resolved.crew?.employeeId ?? null,
    documentCategory: resolved.record?.section ?? resolved.input?.detectedDocumentCategory ?? null,
    matchedErpRecord: resolved.record?.erpRecord ?? null,
    actualAttachmentRef: resolved.record?.attachmentRef ?? null,
    convertedDestinationPath: destinationPath,
    status: resolved.status,
    reason: resolved.reason,
  };
}

async function loadZip(zipBuffer: Buffer): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new Error("The uploaded file is not a valid ZIP archive.");
  }
}

export async function analyzeAttachmentZip(
  zipBuffer: Buffer,
  profile: AttachmentConverterProfile,
  resolvers: AttachmentConverterResolvers,
  overrides?: ResolutionOverride[],
  onProgress?: ConverterProgressCallback,
): Promise<ConversionAnalysis> {
  const zip = await loadZip(zipBuffer);
  const indexedOverrides = indexOverride(overrides);
  const files: CandidatePreview[] = [];
  const report: ConversionReportRow[] = [];
  const entries = sortedFiles(zip);
  onProgress?.({ completed: 0, total: entries.length, percent: entries.length === 0 ? 100 : 0, stage: "analysis" });

  for (const [index, entry] of entries.entries()) {
    const resolved = await resolveInput(profile, entry.name, resolvers, indexedOverrides);
    files.push({
      sourcePath: entry.name,
      parsed: resolved.input,
      crews: resolved.crewCandidates,
      records: resolved.recordCandidates,
      status: resolved.status,
      reason: resolved.reason,
    });
    report.push(reportForResolved(profile, entry.name, resolved, null));
    const completed = index + 1;
    onProgress?.({ completed, total: entries.length, percent: Math.round((completed / entries.length) * 100), stage: "analysis" });
  }

  return { profile: profileSummary(profile), files, report };
}

export async function convertAttachmentZip(
  zipBuffer: Buffer,
  profile: AttachmentConverterProfile,
  resolvers: AttachmentConverterResolvers,
  overrides?: ResolutionOverride[],
  onProgress?: ConverterProgressCallback,
): Promise<ConversionResult> {
  const zip = await loadZip(zipBuffer);
  const indexedOverrides = indexOverride(overrides);
  const outputZip = new JSZip();
  const entries = sortedFiles(zip);
  const totalWork = entries.length + 1;
  const report: ConversionReportRow[] = [];
  const outputPaths = new Set<string>();
  let convertedCount = 0;
  let skippedCount = 0;
  let manualReviewCount = 0;
  onProgress?.({ completed: 0, total: totalWork, percent: totalWork === 0 ? 100 : 0, stage: "conversion" });

  for (const [index, entry] of entries.entries()) {
    const resolved = await resolveInput(profile, entry.name, resolvers, indexedOverrides);
    if (resolved.status !== "converted" || !resolved.crew || !resolved.record || !resolved.input) {
      report.push(reportForResolved(profile, entry.name, resolved, null));
      if (resolved.status === "manual_review") manualReviewCount++;
      else skippedCount++;
      const completed = index + 1;
      onProgress?.({ completed, total: totalWork, percent: Math.round((completed / totalWork) * 100), stage: "conversion" });
      continue;
    }

    const employeeId = outputSegment(resolved.crew.employeeId);
    const attachmentRef = outputSegment(resolved.record.attachmentRef);
    const filename = outputSegment(resolved.input.originalFilename);
    if (!employeeId || !attachmentRef || !filename) {
      const failed = { ...resolved, status: "failed" as const, reason: "Resolved output path contains an unsafe or empty segment." };
      report.push(reportForResolved(profile, entry.name, failed, null));
      skippedCount++;
      const completed = index + 1;
      onProgress?.({ completed, total: totalWork, percent: Math.round((completed / totalWork) * 100), stage: "conversion" });
      continue;
    }

    const destinationPath = `${employeeId}/${attachmentRef}/${filename}`;
    if (outputPaths.has(destinationPath)) {
      const failed = { ...resolved, status: "manual_review" as const, reason: `Multiple source files resolve to the same output path "${destinationPath}".` };
      report.push(reportForResolved(profile, entry.name, failed, destinationPath));
      manualReviewCount++;
      const completed = index + 1;
      onProgress?.({ completed, total: totalWork, percent: Math.round((completed / totalWork) * 100), stage: "conversion" });
      continue;
    }

    let content: Buffer;
    try {
      content = await entry.async("nodebuffer");
      fileStorageService.validateAttachmentBuffer(content);
    } catch (error) {
      const reason = error instanceof AttachmentValidationError
        ? error.message
        : "File could not be read or failed attachment validation.";
      const failed = { ...resolved, status: "failed" as const, reason };
      report.push(reportForResolved(profile, entry.name, failed, null));
      skippedCount++;
      const completed = index + 1;
      onProgress?.({ completed, total: totalWork, percent: Math.round((completed / totalWork) * 100), stage: "conversion" });
      continue;
    }

    outputZip.file(destinationPath, content);
    outputPaths.add(destinationPath);
    convertedCount++;
    report.push(reportForResolved(profile, entry.name, resolved, destinationPath));
    const completed = index + 1;
    onProgress?.({ completed, total: totalWork, percent: Math.round((completed / totalWork) * 100), stage: "conversion" });
  }

  onProgress?.({ completed: entries.length, total: totalWork, percent: Math.round((entries.length / totalWork) * 100), stage: "packaging" });
  const convertedZip = await outputZip.generateAsync({ type: "nodebuffer" });
  onProgress?.({ completed: totalWork, total: totalWork, percent: 100, stage: "complete" });

  return {
    profile: profileSummary(profile),
    convertedZip,
    report,
    convertedCount,
    skippedCount,
    manualReviewCount,
  };
}
