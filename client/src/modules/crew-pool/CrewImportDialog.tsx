import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { crewPoolApiV2 } from "./api/crewPoolApiV2";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface CrewImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Categories mirror the ImportCounts keys returned by the backend.
const IMPORT_CATEGORIES: { key: string; label: string }[] = [
  { key: "crew", label: "Crew Members" },
  { key: "children", label: "Children Details" },
  { key: "nok", label: "Emergency Contacts" },
  { key: "documents", label: "Travel Documents" },
  { key: "visas", label: "Travel Visas" },
  { key: "licenses", label: "Licenses & COCs" },
  { key: "seaService", label: "Sea Service History" },
  { key: "training", label: "Training Courses" },
  { key: "education", label: "Education Details" },
  { key: "medicals", label: "Pre-Joining Medicals" },
  { key: "doctorVisits", label: "Doctor Visits" },
  { key: "briefings", label: "Briefings" },
  { key: "debriefings", label: "De-briefings" },
];

export function CrewImportDialog({ isOpen, onClose }: CrewImportDialogProps) {
  const [mode, setMode] = useState<"data" | "attachments">("data");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "validating" | "valid" | "invalid" | "importing" | "success">("idle");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment ZIP upload (second step of the import flow)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [attachStatus, setAttachStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [attachResult, setAttachResult] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state on close
  const handleClose = () => {
    setMode("data");
    setFile(null);
    setStatus("idle");
    setValidationResult(null);
    setImportResult(null);
    setErrorMessage(null);
    setZipFile(null);
    setAttachStatus("idle");
    setAttachResult(null);
    setUploadProgress(0);
    onClose();
  };

  // Select ZIP for attachment upload
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "zip") {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a ZIP archive of your attachment files.",
      });
      return;
    }
    setZipFile(selectedFile);
    setAttachStatus("idle");
    setAttachResult(null);
  };

  // Upload the attachment ZIP
  const handleUploadAttachments = async () => {
    if (!zipFile) return;
    setAttachStatus("uploading");
    setUploadProgress(0);
    try {
      const buffer = await zipFile.arrayBuffer();
      const res = await crewPoolApiV2.uploadAttachmentsZip(buffer, (pct) => {
        setUploadProgress(pct);
      });
      setUploadProgress(100);
      setAttachResult(res);
      setAttachStatus("done");
      const dupNote = res.duplicates > 0 ? `, ${res.duplicates} duplicate(s)` : "";
      toast({
        title: "Attachments processed",
        description: `${res.imported} file(s) attached, ${res.skippedCount} skipped${dupNote}.`,
      });
    } catch (err: any) {
      setAttachStatus("idle");
      setUploadProgress(0);
      toast({
        variant: "destructive",
        title: "Attachment upload failed",
        description: err.message || "Failed to upload attachments",
      });
    }
  };

  // Trigger file dialog
  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  // Convert file to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check extension
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx" && extension !== "xls" && extension !== "csv") {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
      });
      return;
    }

    setFile(selectedFile);
    setStatus("idle");
    setValidationResult(null);
    setErrorMessage(null);
  };

  // Download blank template from API
  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const blob = await crewPoolApiV2.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SAIL_Crew_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Template downloaded",
        description: "You can now fill the template with your crew data.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: err.message || "Failed to download import template",
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // Validate file (dry-run)
  const handleValidate = async () => {
    if (!file) return;
    setStatus("validating");
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = await crewPoolApiV2.validateImport(buffer);
      setValidationResult(res);
      if (res.isValid) {
        setStatus("valid");
      } else {
        setStatus("invalid");
      }
    } catch (err: any) {
      setStatus("idle");
      setErrorMessage(err.message || "Failed to validate file");
      toast({
        variant: "destructive",
        title: "Validation error",
        description: err.message || "Failed to validate file",
      });
    }
  };

  // Execute actual import
  const handleImport = async () => {
    if (!file) return;
    setStatus("importing");

    try {
      const buffer = await file.arrayBuffer();
      const res = await crewPoolApiV2.executeImport(buffer);
      setImportResult(res);
      if (res.success) {
        setStatus("success");
        // Refetch V2 lists so UI stays synced
        queryClient.invalidateQueries({ queryKey: ["v2", "crew-list"] });
        toast({
          title: "Import complete",
          description: `Successfully imported ${res.imported.crew} crew members.`,
        });
      } else {
        setStatus("invalid");
        setValidationResult(res);
      }
    } catch (err: any) {
      setStatus("valid"); // revert to valid state so they can try again
      toast({
        variant: "destructive",
        title: "Import failed",
        description: err.message || "Failed to execute import",
      });
    }
  };

  // Download skipped-attachments report as a CSV
  const handleDownloadSkippedReport = () => {
    if (!attachResult?.skipped?.length) return;
    const rows: string[] = ["Category,File Path,Reason"];
    for (const s of attachResult.skipped as { path: string; reason: string; category?: string }[]) {
      const escapedCategory = `"${(s.category ?? "").replace(/"/g, '""')}"`;
      const escapedPath = `"${s.path.replace(/"/g, '""')}"`;
      const escapedReason = `"${s.reason.replace(/"/g, '""')}"`;
      rows.push(`${escapedCategory},${escapedPath},${escapedReason}`);
    }
    const csv = rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attachment-skip-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Badge colour per skip category for inline list
  const skipCategoryStyle = (category?: string): string => {
    switch (category) {
      case "Duplicate": return "bg-blue-100 text-blue-700";
      case "Oversized": return "bg-red-100 text-red-700";
      case "Invalid Extension": return "bg-red-100 text-red-700";
      case "No Match": return "bg-amber-100 text-amber-700";
      case "Ambiguous Ref": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  // Download Excel error report returned in base64
  const handleDownloadErrorReport = () => {
    if (!validationResult?.errorReport) return;
    
    try {
      const byteCharacters = atob(validationResult.errorReport);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = validationResult.errorReportFilename || "SAIL_Import_Errors.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to download error report",
        description: err.message,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[550px] p-6"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-[#2c3e50]">
              Import Crew Members
            </DialogTitle>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Step 1: import crew data from the Excel sheet. Step 2: upload a ZIP of the supporting attachment files.
          </p>
        </DialogHeader>

        {/* Mode toggle: Excel data vs attachment ZIP */}
        <div className="flex gap-1 p-1 bg-[#f1f5f9] rounded-lg">
          <button
            type="button"
            data-testid="tab-import-data"
            onClick={() => setMode("data")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              mode === "data" ? "bg-white text-[#2c3e50] shadow-sm" : "text-gray-500"
            }`}
          >
            Crew Data
          </button>
          <button
            type="button"
            data-testid="tab-import-attachments"
            onClick={() => setMode("attachments")}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              mode === "attachments" ? "bg-white text-[#2c3e50] shadow-sm" : "text-gray-500"
            }`}
          >
            Attachments
          </button>
        </div>

        {mode === "data" && (
        <div className="py-4 space-y-4">
          {/* Download Template Button */}
          {status === "idle" && (
            <div className="flex items-center justify-between p-4 bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-8 w-8 text-[#5dc86f]" />
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Need the template?</h4>
                  <p className="text-xs text-gray-500">Download our simple template structure filled with reference data master values.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-[#cbd5e1] text-gray-700"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                data-testid="button-download-template"
              >
                {isDownloadingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                {isDownloadingTemplate ? "Preparing…" : "Template"}
              </Button>
            </div>
          )}

          {/* Upload Box / File Info */}
          {!file ? (
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-[#cbd5e1] hover:border-[#5dc86f] cursor-pointer rounded-lg p-10 space-y-3 bg-[#fafcfd] transition-colors"
              onClick={handleSelectFileClick}
            >
              <Upload className="h-10 w-10 text-gray-400" />
              <div className="text-center">
                <span className="text-[#3b82f6] font-medium hover:underline text-sm">Upload a file</span>
                <span className="text-gray-500 text-sm"> or drag and drop</span>
              </div>
              <p className="text-xs text-gray-400">Excel (.xlsx) or CSV format up to 10MB</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-lg bg-white">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-8 w-8 text-[#3b82f6]" />
                <div>
                  <h4 className="text-sm font-medium text-gray-700 truncate max-w-[280px]">
                    {file.name}
                  </h4>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {status === "idle" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Validation Statuses */}
          {status === "validating" && (
            <div className="flex flex-col items-center justify-center p-6 space-y-3">
              <Loader2 className="h-8 w-8 text-[#3b82f6] animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Validating file & links...</p>
            </div>
          )}

          {status === "importing" && (
            <div className="flex flex-col items-center justify-center p-6 space-y-3">
              <Loader2 className="h-8 w-8 text-[#5dc86f] animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Importing crew data into database...</p>
            </div>
          )}

          {status === "invalid" && validationResult && (
            <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-center space-x-2 text-red-700 font-medium text-sm">
                <AlertTriangle className="h-5 w-5" />
                <span>Validation Failed ({validationResult.errors.length} errors found)</span>
              </div>
              <p className="text-xs text-gray-600">
                Correct the errors in the Excel sheet and upload again. Download the error report to view which cells failed.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-red-200 text-red-700 hover:bg-red-100"
                  onClick={handleDownloadErrorReport}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download Error Report
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-600"
                  onClick={() => {
                    setFile(null);
                    setStatus("idle");
                    setValidationResult(null);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              </div>
            </div>
          )}

          {status === "valid" && validationResult && (
            <div className="space-y-4 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
              <div className="flex items-center space-x-2 text-emerald-800 font-medium text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span>Validation Successful!</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                {IMPORT_CATEGORIES.map((cat) => (
                  <div key={cat.key} className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-gray-500 block">{cat.label}</span>
                    <span
                      className="font-semibold text-gray-800 text-sm"
                      data-testid={`text-${cat.key}-count`}
                    >
                      {validationResult.summary?.[cat.key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === "success" && importResult && (
            <div className="space-y-4 p-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-14 w-14 text-[#5dc86f] mx-auto" />
                <h3 className="text-lg font-semibold text-gray-800">Crew Imported Successfully</h3>
                <p className="text-sm text-gray-500">
                  Successfully completed bulk import. {importResult.imported.crew} seafarers are now added to your database.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {IMPORT_CATEGORIES.map((cat) => {
                  const imported = importResult.imported?.[cat.key] ?? 0;
                  const expected = importResult.expected?.[cat.key] ?? imported;
                  return (
                    <div key={cat.key} className="bg-[#f8fafc] p-2.5 rounded border border-[#e2e8f0]">
                      <span className="text-gray-500 block">{cat.label}</span>
                      <span
                        className="font-semibold text-gray-800 text-sm"
                        data-testid={`text-imported-${cat.key}`}
                      >
                        {imported} / {expected}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="text-center">
                <Button className="bg-[#5dc86f] text-white hover:bg-[#218838]" onClick={handleClose}>
                  Finish
                </Button>
              </div>
            </div>
          )}
        </div>
        )}

        {mode === "attachments" && (
          <div className="py-4 space-y-4">
            <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs text-gray-600">
              Zip your files so each one sits in a{" "}
              <span className="font-mono text-gray-800">&lt;Employee ID&gt;/&lt;Attachment Ref&gt;/</span>{" "}
              folder (the Attachment Ref comes from the Excel sheet), then upload the ZIP here.
            </div>

            {!zipFile ? (
              <div
                className="flex flex-col items-center justify-center border-2 border-dashed border-[#cbd5e1] hover:border-[#5dc86f] cursor-pointer rounded-lg p-10 space-y-3 bg-[#fafcfd] transition-colors"
                onClick={() => zipInputRef.current?.click()}
                data-testid="dropzone-attachments-zip"
              >
                <Upload className="h-10 w-10 text-gray-400" />
                <div className="text-center">
                  <span className="text-[#3b82f6] font-medium hover:underline text-sm">Upload a ZIP</span>
                  <span className="text-gray-500 text-sm"> of attachment files</span>
                </div>
                <p className="text-xs text-gray-400">PDF, PNG or JPEG files, up to 5MB each</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-lg bg-white">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-8 w-8 text-[#3b82f6]" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 truncate max-w-[280px]" data-testid="text-zip-name">
                      {zipFile.name}
                    </h4>
                    <p className="text-xs text-gray-400">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {attachStatus === "idle" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-gray-600"
                    onClick={() => setZipFile(null)}
                    data-testid="button-clear-zip"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {attachStatus === "uploading" && (
              <div className="space-y-3 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg" data-testid="upload-progress-container">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-[#5dc86f] animate-spin" />
                    Uploading & attaching files…
                  </span>
                  <span className="text-gray-500 tabular-nums" data-testid="text-upload-percent">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5dc86f] rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                    data-testid="progress-bar-upload"
                  />
                </div>
                {zipFile && (
                  <p className="text-xs text-gray-400">
                    {(zipFile.size / 1024 / 1024).toFixed(2)} MB total
                  </p>
                )}
              </div>
            )}

            {attachStatus === "done" && attachResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-emerald-50 p-2.5 rounded border border-emerald-100">
                    <span className="text-gray-500 block">Files Attached</span>
                    <span className="font-semibold text-emerald-700 text-sm" data-testid="text-attached-count">
                      {attachResult.imported}
                    </span>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded border border-amber-100">
                    <span className="text-gray-500 block">Skipped</span>
                    <span className="font-semibold text-amber-700 text-sm" data-testid="text-skipped-count">
                      {attachResult.skippedCount}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#e2e8f0]">
                    <span className="text-gray-500 block">Records Covered</span>
                    <span className="font-semibold text-gray-800 text-sm" data-testid="text-records-covered">
                      {attachResult.recordsCovered}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-[#e2e8f0]">
                    <span className="text-gray-500 block">Crew Covered</span>
                    <span className="font-semibold text-gray-800 text-sm" data-testid="text-crew-covered">
                      {attachResult.crewCovered}
                    </span>
                  </div>
                </div>

                {attachResult.skipped?.length > 0 && (
                  <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-amber-700 font-medium">
                      {attachResult.skipped.length} file{attachResult.skipped.length !== 1 ? "s" : ""} skipped
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={handleDownloadSkippedReport}
                      data-testid="button-download-skipped-report"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download report
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-amber-100 rounded-lg divide-y divide-amber-50">
                    {attachResult.skipped.map((s: { path: string; reason: string; category?: string }, i: number) => (
                      <div key={i} className="p-2.5 text-xs" data-testid={`row-skipped-${i}`}>
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {s.category && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${skipCategoryStyle(s.category)}`}>
                                  {s.category}
                                </span>
                              )}
                              <p className="font-mono text-gray-700 break-all">{s.path}</p>
                            </div>
                            <p className="text-gray-500">{s.reason}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                )}
              </div>
            )}

            <input
              type="file"
              ref={zipInputRef}
              onChange={handleZipChange}
              accept=".zip"
              className="hidden"
            />
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
          className="hidden"
        />

        {mode === "data" && status !== "success" && (
          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4">
            <Button variant="outline" onClick={handleClose} disabled={status === "validating" || status === "importing"}>
              Cancel
            </Button>

            {file && status === "idle" && (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleValidate}>
                Validate File
              </Button>
            )}

            {status === "valid" && (
              <Button className="bg-[#5dc86f] text-white hover:bg-[#218838]" onClick={handleImport}>
                Confirm Import
              </Button>
            )}
          </DialogFooter>
        )}

        {mode === "attachments" && (
          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4">
            <Button variant="outline" onClick={handleClose} disabled={attachStatus === "uploading"}>
              {attachStatus === "done" ? "Close" : "Cancel"}
            </Button>

            {zipFile && attachStatus !== "done" && (
              <Button
                className="bg-[#5dc86f] text-white hover:bg-[#218838]"
                onClick={handleUploadAttachments}
                disabled={attachStatus === "uploading"}
                data-testid="button-upload-attachments"
              >
                Upload Attachments
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
