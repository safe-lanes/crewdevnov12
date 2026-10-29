import type {
  AttachmentConverterProfile,
  ParsedAttachment,
} from "./types";
import {
  categoryForDocumentName,
  normalizeProfileAlias,
} from "./profiles";

function cleanPathSegments(rawPath: string): { segments: string[]; reason?: string } {
  if (!rawPath || rawPath.includes("\\") || rawPath.startsWith("/") || /^[A-Za-z]:/.test(rawPath)) {
    return { segments: [], reason: "Absolute paths and backslash-separated paths are not accepted in ZIP entries." };
  }

  const rawSegments = rawPath.split("/");
  if (rawSegments.some((segment) => segment === "..")) {
    return { segments: [], reason: "Unsafe path: parent traversal is not allowed." };
  }

  const segments = rawSegments.filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.some((segment) => segment.includes("\0"))) {
    return { segments: [], reason: "Unsafe path: NUL characters are not allowed." };
  }

  return { segments };
}

function extensionFor(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLocaleLowerCase() : "";
}

function mimeForExtension(extension: string): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return null;
}

function removeExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(0, dot) : filename;
}

export function parseAttachmentPath(
  profile: AttachmentConverterProfile,
  originalFilePath: string,
): ParsedAttachment {
  const cleaned = cleanPathSegments(originalFilePath);
  if (cleaned.reason) {
    return {
      input: null,
      error: { code: "INVALID_PATH", reason: cleaned.reason },
    };
  }

  let segments = cleaned.segments;
  if (profile.rootFolder.mode === "optional-wrapper" && segments.length === 3) {
    segments = segments.slice(1);
  }
  if (segments.length !== 2) {
    return {
      input: null,
      error: {
        code: "INVALID_PATH",
        reason: "Expected <Crew Name>/<Crew Name>. <Document Name>.pdf, with at most one optional ZIP wrapper folder.",
      },
    };
  }

  const [crewName, filename] = segments;
  const extension = extensionFor(filename);
  const mimeType = mimeForExtension(extension);
  if (!mimeType || !profile.supportedFileTypes.includes(mimeType)) {
    return {
      input: null,
      error: {
        code: "UNSUPPORTED_FILE_TYPE",
        reason: `File type ".${extension || "(none)"}" is not supported by profile ${profile.profileId}.`,
      },
    };
  }

  const withoutExtension = removeExtension(filename);
  const expectedPrefix = `${crewName}${profile.filenameParsing.separator}`;
  if (!withoutExtension.startsWith(expectedPrefix)) {
    return {
      input: null,
      error: {
        code: "INVALID_FILENAME",
        reason: `Filename must begin with "${expectedPrefix}" and contain a document name.`,
      },
    };
  }

  const documentName = withoutExtension.slice(expectedPrefix.length).trim();
  if (profile.requiredValidation.requireCrew && !crewName.trim()) {
    return {
      input: null,
      error: { code: "MISSING_CREW", reason: "Crew folder name is empty." },
    };
  }
  if (profile.requiredValidation.requireDocumentName && !documentName) {
    return {
      input: null,
      error: { code: "MISSING_DOCUMENT_NAME", reason: "Document name is empty." },
    };
  }

  const category = categoryForDocumentName(profile, documentName);
  return {
    input: {
      originalFilePath,
      extractedCrewName: crewName,
      extractedEmployeeId: null,
      extractedDocumentName: documentName,
      detectedDocumentCategory: category,
      originalFilename: filename,
    },
    ...(profile.requiredValidation.requireCategory && !category && profile.documentCategory.resolution === "aliases-only"
      ? {
          error: {
            code: "UNKNOWN_CATEGORY" as const,
            reason: `Document name "${documentName}" is not an approved category alias for profile ${profile.profileId}.`,
          },
        }
      : {}),
  };
}

export function normalizeCrewName(value: string | null | undefined): string {
  return normalizeProfileAlias(value ?? "");
}
