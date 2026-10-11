import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCrewUserId } from "@/lib/crewUser";
import { importRequest } from "./importRequest";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface ImportValidationError {
  sheet: string;
  cell: string;
  field: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  candidateName: string;
  status: "Applied";
  summary: Record<string, number>;
  errors: ImportValidationError[];
}

interface ExecuteResult {
  success: true;
  recCanUuid: string;
  status: "Applied";
}

interface ExcelImportCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void | Promise<void>;
  onOpenCandidate: (recCanUuid: string) => void;
}

async function readError(response: Response): Promise<{ message?: string; errors?: ImportValidationError[] }> {
  try {
    return await response.json();
  } catch {
    return { message: `Request failed (${response.status}). Please try again.` };
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this file. Please choose it again."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function ExcelImportCandidateDialog({
  open,
  onOpenChange,
  onImportSuccess,
  onOpenCandidate,
}: ExcelImportCandidateDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const executeLock = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ValidationResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<ImportValidationError[]>([]);
  const [busy, setBusy] = useState<"template" | "validate" | "execute" | null>(null);
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState<ExecuteResult | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setValidationErrors([]);
    setFailure("");
    setSuccess(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (busy) return;
    if (!nextOpen) reset();
    else executeLock.current = false;
    onOpenChange(nextOpen);
  };

  const chooseFile = (next: File | null) => {
    if (busy || success) return;
    setPreview(null);
    setValidationErrors([]);
    setFailure("");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      setFailure("Choose an Excel workbook with the .xlsx file extension.");
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      setFailure("This workbook is larger than 5 MB. Choose a smaller file.");
      return;
    }
    setFile(next);
  };

  const downloadTemplate = async () => {
    setBusy("template");
    setFailure("");
    try {
      const response = await importRequest("template");
      if (!response.ok) {
        const body = await readError(response);
        throw new Error(body.message || `Template download failed (${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "candidate-import-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Template download failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const validateFile = async () => {
    if (!file || busy) return;
    setBusy("validate");
    setFailure("");
    setPreview(null);
    setValidationErrors([]);
    try {
      const fileData = await fileToBase64(file);
      const response = await importRequest("validate", { fileData, fileName: file.name, auditUserUuid: getCrewUserId() });
      const result = response.ok
        ? await response.json() as ValidationResult
        : await readError(response);
      if (!response.ok) {
        const errorResult = result as { message?: string; errors?: ImportValidationError[] };
        setValidationErrors(errorResult.errors ?? []);
        throw new Error(errorResult.message || `Validation failed (${response.status}).`);
      }
      const validation = result as ValidationResult;
      setPreview(validation);
      setValidationErrors(validation.errors ?? []);
      if (!validation.isValid) setFailure("Please correct the workbook issues below, then choose the updated file.");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Validation failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const executeImport = async () => {
    if (!file || !preview?.isValid || busy || executeLock.current) return;
    executeLock.current = true;
    setBusy("execute");
    setFailure("");
    try {
      const fileData = await fileToBase64(file);
      const response = await importRequest("execute", { fileData, fileName: file.name, auditUserUuid: getCrewUserId() });
      if (!response.ok) {
        const body = await readError(response);
        setValidationErrors(body.errors ?? []);
        throw new Error(body.message || `Import failed (${response.status}).`);
      }
      const result = await response.json() as ExecuteResult;
      // Refresh the active list before offering its deep link. Otherwise the
      // module can treat the new UUID as unknown and redirect back to the list.
      await onImportSuccess();
      setSuccess(result);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Import failed. Please try again.");
      executeLock.current = false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[92dvh] w-[calc(100%-1.25rem)] max-w-[600px] overflow-hidden rounded-xl border border-[#d9e2ec] bg-[#fbfcfd] p-0 shadow-[0_24px_70px_rgba(20,48,77,0.22)]"
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}
        aria-describedby="candidate-import-description"
      >
        <DialogHeader className="border-b border-[#e3e9ef] bg-[#f2f6f8] px-5 py-4 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e0edf2] text-[#17617a]">
              <FileSpreadsheet className="h-[18px] w-[18px]" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold tracking-[-0.02em] text-[#18354a]">Import candidate from Excel</DialogTitle>
              <DialogDescription id="candidate-import-description" className="mt-1 text-xs leading-relaxed text-[#647889]">
                Add one candidate as <span className="font-semibold text-[#286b54]">Applied</span>. Review the validation before creating anything.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-[#6b7c89] hover:bg-[#e7eef2]"
              onClick={() => handleOpenChange(false)}
              disabled={!!busy}
              aria-label="Close import dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92dvh-76px)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {success ? (
            <section aria-live="polite" className="rounded-lg border border-[#b9ddcc] bg-[#eff8f2] p-5">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#29805a]" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-[#245d42]">Candidate imported</h3>
                  <p className="mt-1 text-sm text-[#486d58]">
                    {preview?.candidateName || "Candidate"} was added with status Applied.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 h-9 bg-[#17617a] px-4 text-xs text-white hover:bg-[#104d62]"
                    onClick={() => onOpenCandidate(success.recCanUuid)}
                  >
                    Open Candidate
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-lg border border-[#dbe5ea] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#29475a]">Start with the workbook template</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#718391]">Fill A1–A5 on the single-sheet application form. Leave unused boxes blank; keep the layout unchanged.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 gap-2 border-[#cad8df] bg-[#fbfdfe] text-xs text-[#315668] hover:bg-[#edf5f7]"
                  onClick={downloadTemplate}
                  disabled={!!busy}
                >
                  {busy === "template" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download .xlsx template
                </Button>
              </div>

              <section>
                <label
                  htmlFor="candidate-excel-file"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#527080]"
                >
                  Candidate workbook
                </label>
                <input
                  ref={inputRef}
                  id="candidate-excel-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={!!busy}
                  onChange={(event) => chooseFile(event.currentTarget.files?.[0] ?? null)}
                  aria-describedby="candidate-file-help"
                />
                <div className="flex min-h-[82px] flex-col items-start justify-between gap-3 rounded-lg border border-dashed border-[#b9cbd4] bg-[#f7fafb] p-3 sm:flex-row sm:items-center sm:p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e8f0f3] text-[#397086]">
                      <Upload className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="max-w-[290px] truncate text-sm font-medium text-[#345365]">{file?.name ?? "No workbook selected"}</p>
                      <p id="candidate-file-help" className="mt-1 text-[11px] text-[#788c98]">.xlsx format · maximum 5 MB</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 shrink-0 border-[#d2dee4] bg-white px-3 text-xs text-[#345365]"
                    onClick={() => inputRef.current?.click()}
                    disabled={!!busy}
                  >
                    Choose file
                  </Button>
                </div>
                {file && (
                  <Button
                    type="button"
                    className="mt-3 h-9 gap-2 bg-[#17617a] px-4 text-xs text-white hover:bg-[#104d62]"
                    onClick={validateFile}
                    disabled={!!busy}
                  >
                    {busy === "validate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Validate workbook
                  </Button>
                )}
              </section>

              {preview && (
                <section aria-live="polite" className="rounded-lg border border-[#dbe5ea] bg-white">
                  <div className="flex flex-col gap-2 border-b border-[#e8eef1] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#29475a]">Validation preview</h3>
                      <p className="mt-0.5 text-xs text-[#718391]">{preview.candidateName || "Candidate"} · status will be Applied</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${preview.isValid ? "bg-[#e9f5ee] text-[#286b4c]" : "bg-[#fff1e9] text-[#a85528]"}`}>
                      {preview.isValid ? "Ready to import" : "Needs attention"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-[#e8eef1] sm:grid-cols-3">
                    {Object.entries(preview.summary ?? {}).map(([label, count]) => (
                      <div key={label} className="bg-[#fbfcfd] px-4 py-3">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[#81919b]">{label}</p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#29475a]">{count}</p>
                      </div>
                    ))}
                    {Object.keys(preview.summary ?? {}).length === 0 && (
                      <p className="col-span-full bg-[#fbfcfd] px-4 py-3 text-xs text-[#718391]">No additional summary counts.</p>
                    )}
                  </div>
                </section>
              )}

              {validationErrors.length > 0 && (
                <section aria-live="polite" className="overflow-hidden rounded-lg border border-[#f0c9b5] bg-[#fffaf7]">
                  <div className="flex items-center gap-2 border-b border-[#f4ded2] px-4 py-3 text-[#92512f]">
                    <AlertCircle className="h-4 w-4" />
                    <h3 className="text-xs font-semibold">{validationErrors.length} workbook issue{validationErrors.length === 1 ? "" : "s"}</h3>
                  </div>
                  <ul className="max-h-48 divide-y divide-[#f5e5dc] overflow-y-auto">
                    {validationErrors.map((item, index) => (
                      <li key={`${item.sheet}-${item.cell}-${item.field}-${index}`} className="px-4 py-2.5">
                        <p className="text-xs font-medium text-[#77462f]">
                          {item.sheet} · {item.cell}{item.field ? ` · ${item.field}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#8e6652]">{item.message}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {failure && (
                <p role="alert" className="rounded-md border border-[#f0c9b5] bg-[#fff6f1] px-3 py-2.5 text-xs leading-relaxed text-[#994b28]">
                  {failure}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-[#e6ecef] pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="h-9 border-[#d4dfe4] bg-white text-xs text-[#617684]" onClick={() => handleOpenChange(false)} disabled={!!busy}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 gap-2 bg-[#286b4c] px-4 text-xs text-white hover:bg-[#205b40]"
                  onClick={executeImport}
                  disabled={!preview?.isValid || !!busy || !file}
                >
                  {busy === "execute" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm &amp; import candidate
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
