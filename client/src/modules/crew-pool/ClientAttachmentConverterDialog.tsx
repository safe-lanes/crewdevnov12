import { useEffect, useMemo, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { crewPoolApiV2 } from "./api/crewPoolApiV2";

interface ClientAttachmentConverterDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConversionFileCandidates {
  crews?: { crewName: string; employeeId: string }[];
  records?: { erpRecord: string; attachmentRef: string }[];
}

function downloadBytes(base64: string, filename: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ClientAttachmentConverterDialog({
  isOpen,
  onClose,
}: ClientAttachmentConverterDialogProps) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileId, setProfileId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressPhase, setProgressPhase] = useState<"uploading" | "backend" | null>(null);
  const [backendProgress, setBackendProgress] = useState<{ completed: number; total: number; stage: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const manualFiles = useMemo(
    () => (analysis?.files ?? []).filter((item: any) => item.status === "manual_review"),
    [analysis],
  );

  const reportRows = useMemo(() => {
    const report = result?.report ?? analysis?.report ?? [];
    const filesByPath = new Map<string, ConversionFileCandidates>(
      (analysis?.files ?? []).map((item: any) => [item.sourcePath, item]),
    );
    return report.map((row: any) => {
      const file = filesByPath.get(row.originalFilePath);
      return {
        ...row,
        candidateCrews: (file?.crews ?? []).map((crew: any) => `${crew.crewName} (${crew.employeeId})`).join("; "),
        candidateRecords: (file?.records ?? []).map((record: any) => `${record.erpRecord} (${record.attachmentRef})`).join("; "),
      };
    });
  }, [analysis, result]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    crewPoolApiV2.listAttachmentConverterProfiles()
      .then((items) => {
        if (cancelled) return;
        setProfiles(items);
        if (!profileId && items[0]?.profileId) setProfileId(items[0].profileId);
      })
      .catch((reason) => !cancelled && setError(reason?.message ?? "Failed to load profiles."));
    return () => { cancelled = true; };
  }, [isOpen, profileId]);

  const selectFile = async (nextFile: File | null) => {
    setFile(nextFile);
    setAnalysis(null);
    setResult(null);
    setProgress(null);
    setProgressPhase(null);
    setBackendProgress(null);
    setError(null);
    setFileBuffer(nextFile ? await nextFile.arrayBuffer() : null);
  };

  const analyze = async () => {
    if (!fileBuffer || !profileId) return;
    setBusy(true);
    setProgress(0);
    setProgressPhase("uploading");
    setError(null);
    try {
      setAnalysis(await crewPoolApiV2.analyzeAttachmentConversion(
        fileBuffer,
        profileId,
        [],
        (serverProgress) => {
          setProgress(serverProgress.percent);
          setProgressPhase("backend");
          setBackendProgress(serverProgress);
        },
        (uploadPercent) => {
          setProgress(uploadPercent);
          setProgressPhase("uploading");
        },
      ));
    } catch (reason: any) {
      setError(reason?.message ?? "Analysis failed.");
    } finally {
      setBusy(false);
      setProgressPhase(null);
    }
  };

  const convert = async () => {
    if (!fileBuffer || !profileId || !analysis) return;
    setBusy(true);
    setProgress(0);
    setProgressPhase("uploading");
    setError(null);
    try {
      const converted = await crewPoolApiV2.convertAttachmentConversion(
        fileBuffer,
        profileId,
        [],
        (serverProgress) => {
          setProgress(serverProgress.percent);
          setProgressPhase("backend");
          setBackendProgress(serverProgress);
        },
        (uploadPercent) => {
          setProgress(uploadPercent);
          setProgressPhase("uploading");
        },
      );
      setResult(converted);
    } catch (reason: any) {
      setError(reason?.message ?? "Conversion failed.");
    } finally {
      setBusy(false);
      setProgressPhase(null);
    }
  };

  const reset = () => {
    setFile(null);
    setFileBuffer(null);
    setAnalysis(null);
    setResult(null);
    setProgress(null);
    setProgressPhase(null);
    setBackendProgress(null);
    setError(null);
  };

  const downloadExcelReport = () => {
    if (reportRows.length === 0) return;
    const workbook = XLSX.utils.book_new();
    const summaryRows = [{
      profileId: result?.profile?.profileId ?? analysis?.profile?.profileId ?? "",
      profileName: result?.profile?.name ?? analysis?.profile?.name ?? "",
      profileVersion: result?.profile?.version ?? analysis?.profile?.version ?? "",
      sourceFile: file?.name ?? "",
      totalFiles: reportRows.length,
      converted: reportRows.filter((row: any) => row.status === "converted").length,
      manualReview: reportRows.filter((row: any) => row.status === "manual_review").length,
      skipped: reportRows.filter((row: any) => row.status === "skipped").length,
      failed: reportRows.filter((row: any) => row.status === "failed").length,
    }];
    const append = (name: string, rows: any[]) => {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
    };
    append("Summary", summaryRows);
    append("All Files", reportRows);
    append("Converted", reportRows.filter((row: any) => row.status === "converted"));
    append("Manual Review", reportRows.filter((row: any) => row.status === "manual_review"));
    append("Skipped", reportRows.filter((row: any) => row.status === "skipped"));
    append("Failed", reportRows.filter((row: any) => row.status === "failed"));
    XLSX.writeFile(workbook, "SAIL_Attachment_Conversion_Report.xlsx");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client Attachment Converter</DialogTitle>
          <DialogDescription>
            Convert a client ZIP to SAIL&apos;s Employee ID / actual Attachment Ref layout. This workflow does not import attachments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Rule profile</span>
              <select
                value={profileId}
                onChange={(event) => { setProfileId(event.target.value); setAnalysis(null); setResult(null); }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-attachment-converter-profile"
              >
                {profiles.map((profile) => (
                  <option key={profile.profileId} value={profile.profileId}>
                    {profile.name} (v{profile.version})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Client ZIP</span>
              <Input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
                data-testid="input-attachment-converter-zip"
              />
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <span className="truncate">{file.name}</span>
              <Button variant="ghost" size="icon" onClick={reset} aria-label="Clear ZIP">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => void analyze()} disabled={!fileBuffer || !profileId || busy}>
              <Upload className="mr-2 h-4 w-4" />
              {busy && !analysis ? "Analyzing ZIP…" : "Analyze ZIP"}
            </Button>
            {analysis && (
              <Button variant="outline" onClick={() => void convert()} disabled={busy}>
                {busy ? "Generating ZIP…" : "Generate converted ZIP"}
              </Button>
            )}
          </div>

          {busy && progress !== null && (
            <div className="space-y-1 rounded-md border bg-slate-50 p-3" data-testid="attachment-converter-progress">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {progressPhase === "uploading"
                    ? "Uploading ZIP"
                    : backendProgress
                      ? `${backendProgress.stage === "packaging" ? "Packaging converted ZIP" : "Processing files on server"} — ${backendProgress.completed} / ${backendProgress.total}`
                      : "Upload complete — waiting for backend progress"}
                </span>
                <span className="tabular-nums text-slate-600">{progressPhase === "backend" ? `${progress}% processed` : `${progress}% uploaded`}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#16569e] transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {analysis && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded border p-2"><span className="text-slate-500">Files</span><div className="font-semibold">{analysis.files.length}</div></div>
                <div className="rounded border p-2"><span className="text-slate-500">Ready</span><div className="font-semibold text-green-700">{analysis.files.filter((item: any) => item.status === "converted").length}</div></div>
                <div className="rounded border p-2"><span className="text-slate-500">Manual review</span><div className="font-semibold text-amber-700">{manualFiles.length}</div></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-slate-50 p-3 text-sm">
                <span className="text-slate-600">Detailed reasons and candidate mappings are available in the Excel report.</span>
                <Button size="sm" variant="outline" onClick={downloadExcelReport}>
                  <Download className="mr-2 h-4 w-4" /> Download Excel report
                </Button>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm">
              <span className="font-medium text-green-800">Converted {result.convertedCount} file(s); nothing was imported.</span>
              <Button size="sm" onClick={() => downloadBytes(result.convertedZip, "SAIL_Converted_Attachments.zip", "application/zip")}>
                <Download className="mr-2 h-4 w-4" /> ZIP
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadBytes(btoa(JSON.stringify(result.report, null, 2)), "SAIL_Attachment_Conversion_Report.json", "application/json")}>
                <Download className="mr-2 h-4 w-4" /> Report
              </Button>
              <Button size="sm" variant="outline" onClick={downloadExcelReport}>
                <Download className="mr-2 h-4 w-4" /> Excel report
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
