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

export function CrewImportDialog({ isOpen, onClose }: CrewImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "validating" | "valid" | "invalid" | "importing" | "success">("idle");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state on close
  const handleClose = () => {
    setFile(null);
    setBase64Data(null);
    setStatus("idle");
    setValidationResult(null);
    setImportResult(null);
    setErrorMessage(null);
    onClose();
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Get base64 string without data url prefix
      const base64 = result.split(",")[1];
      setBase64Data(base64);
    };
    reader.readAsDataURL(selectedFile);
  };

  // Download blank template from API
  const handleDownloadTemplate = async () => {
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
    }
  };

  // Validate file (dry-run)
  const handleValidate = async () => {
    if (!base64Data) return;
    setStatus("validating");
    setErrorMessage(null);

    try {
      const res = await crewPoolApiV2.validateImport(base64Data);
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
    if (!base64Data) return;
    setStatus("importing");

    try {
      const res = await crewPoolApiV2.executeImport(base64Data);
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
      <DialogContent className="sm:max-w-[550px] p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-[#2c3e50]">
              Import Crew Members
            </DialogTitle>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Bulk-import crew members, travel docs, licenses, sea service, and training using a simple Excel sheet.
          </p>
        </DialogHeader>

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
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Template
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
                    setBase64Data(null);
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
                    setBase64Data(null);
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
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Crew Members</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.crewCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Children Details</span>
                  <span className="font-semibold text-gray-800 text-sm" data-testid="text-children-count">{validationResult.summary.childrenCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Emergency Contacts</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.nokCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Travel Documents</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.documentsCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Travel Visas</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.visasCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Licenses & COCs</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.licensesCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Sea Service History</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.seaServiceCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Training Courses</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.trainingCount}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100">
                  <span className="text-gray-500 block">Education Details</span>
                  <span className="font-semibold text-gray-800 text-sm">{validationResult.summary.educationCount}</span>
                </div>
              </div>
            </div>
          )}

          {status === "success" && importResult && (
            <div className="space-y-4 text-center p-6">
              <CheckCircle className="h-14 w-14 text-[#5dc86f] mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Crew Imported Successfully</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Successfully completed bulk import. {importResult.imported.crew} seafarers are now added to your database.
                </p>
              </div>
              <Button className="bg-[#5dc86f] text-white hover:bg-[#218838]" onClick={handleClose}>
                Finish
              </Button>
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
          className="hidden"
        />

        {status !== "success" && (
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
      </DialogContent>
    </Dialog>
  );
}
