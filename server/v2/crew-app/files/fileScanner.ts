import { createHash } from "crypto";

export type FileScanStatus = "clean" | "infected" | "failed" | "rejected";
export interface FileScanResult { status: FileScanStatus; scanner: string; version?: string; reason?: string; checksumSha256: string }
export interface FileScanner { scan(buffer: Buffer, mime: string): Promise<FileScanResult> }

let scanner: FileScanner | null = null;
export function registerCrewFileScanner(value: FileScanner): void { scanner = value; }
export function clearCrewFileScanner(): void { scanner = null; }

function checksum(buffer: Buffer): string { return createHash("sha256").update(buffer).digest("hex"); }

function structurallyValid(buffer: Buffer, mime: string): boolean {
  if (mime === "application/pdf") {
    const tail = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1");
    return buffer.subarray(0, 5).toString("latin1") === "%PDF-" && tail.includes("%%EOF") && !/\/JavaScript\b|\/Launch\b|\/EmbeddedFile\b/i.test(buffer.toString("latin1"));
  }
  if (mime === "image/jpeg") return buffer.length > 4 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  if (mime === "image/png") return buffer.length > 20 && buffer.includes(Buffer.from("IEND"));
  return false;
}

export async function scanCrewFile(buffer: Buffer, mime: string): Promise<FileScanResult> {
  const checksumSha256 = checksum(buffer);
  if (!structurallyValid(buffer, mime)) return { status: "rejected", scanner: "structural-validator", reason: "invalid_or_active_content", checksumSha256 };
  if (!scanner) return { status: "failed", scanner: "unavailable", reason: "scanner_not_configured", checksumSha256 };
  try {
    const result = await scanner.scan(buffer, mime);
    return { ...result, checksumSha256 };
  } catch {
    return { status: "failed", scanner: "configured-scanner", reason: "scanner_error", checksumSha256 };
  }
}
