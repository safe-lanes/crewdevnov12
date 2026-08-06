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
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  X,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Layers,
  Users,
} from "lucide-react";

interface VesselAssignmentImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VesselAssignmentImportDialog({ isOpen, onClose }: VesselAssignmentImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"hierarchy" | "assignments">("hierarchy");
  const [file, setFile] = useState<File | null>(null);

  const [stage1Status, setStage1Status] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [stage1Result, setStage1Result] = useState<any>(null);

  const [stage2Status, setStage2Status] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [stage2Result, setStage2Result] = useState<any>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleClose = () => {
    setActiveTab("hierarchy");
    setFile(null);
    setStage1Status("idle");
    setStage1Result(null);
    setStage2Status("idle");
    setStage2Result(null);
    setErrorMessage(null);
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const res = await fetch("/api/v2/vessel/import/generate-workbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: "" }),
      });

      if (!res.ok) throw new Error("Template download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Vessel_Crew_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Template Downloaded",
        description: "Vessel Rank Hierarchy & Crew Assignment template has been downloaded.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Template Download",
        description: "Please upload your reviewed workbook or crew list ZIP archive.",
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx" && extension !== "xls" && extension !== "csv") {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx) file containing reviewed import sheets.",
      });
      return;
    }

    setFile(selectedFile);
    setStage1Status("idle");
    setStage1Result(null);
    setStage2Status("idle");
    setStage2Result(null);
    setErrorMessage(null);
  };

  // Stage 1: Import Vessel Rank Hierarchy
  const handleImportHierarchy = async () => {
    if (!file) return;
    setStage1Status("importing");
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch("/api/v2/vessel/import/hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buffer,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import rank hierarchy");
      }

      setStage1Result(data);
      setStage1Status("success");

      queryClient.invalidateQueries({ queryKey: ["/api/v2/vessel/planning"] });
      queryClient.invalidateQueries({ queryKey: ["vessel-revisions"] });

      toast({
        title: "Section 1 Complete — Rank Hierarchy Published",
        description: `Processed ${data.vesselsProcessed} vessel(s), published ${data.activeRanksCount} active rank slots.`,
      });
    } catch (err: any) {
      setStage1Status("error");
      setErrorMessage(err.message || "Failed to import rank hierarchy");
      toast({
        variant: "destructive",
        title: "Section 1 Failed",
        description: err.message || "An error occurred during hierarchy import.",
      });
    }
  };

  // Stage 2: Import Crew Assignments
  const handleImportAssignments = async () => {
    if (!file) return;
    setStage2Status("importing");
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch("/api/v2/vessel/import/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buffer,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import crew assignments");
      }

      setStage2Result(data);
      setStage2Status("success");

      queryClient.invalidateQueries({ queryKey: ["/api/v2/vessel/planning"] });
      queryClient.invalidateQueries({ queryKey: ["crew-pool"] });

      toast({
        title: "Section 2 Complete — Crew Assignments Imported",
        description: `Imported ${data.primaryAssignedCount} primary onboard crew and ${data.secondaryAssignedCount} relievers.`,
      });
    } catch (err: any) {
      setStage2Status("error");
      setErrorMessage(err.message || "Failed to import crew assignments");
      toast({
        variant: "destructive",
        title: "Section 2 Failed",
        description: err.message || "An error occurred during assignments import.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-[620px] p-6 max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#2c3e50]">
            Vessel Rank Hierarchy & Crew Assignment Import
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Section 1: import vessel rank hierarchy. Section 2: import crew assignments to position slots.
          </p>
        </DialogHeader>

        {/* Section Tabs (Crew Import Style) */}
        <div className="flex border-b border-[#e2e8f0] mb-4 bg-[#f8fafc] p-1 rounded-lg mt-2">
          <button
            type="button"
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
              activeTab === "hierarchy"
                ? "bg-white text-gray-900 shadow-sm font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("hierarchy")}
          >
            <Layers className="h-4 w-4 text-[#3b82f6]" />
            Section 1: Vessel Rank Hierarchy
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
              activeTab === "assignments"
                ? "bg-white text-gray-900 shadow-sm font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("assignments")}
          >
            <Users className="h-4 w-4 text-[#5dc86f]" />
            Section 2: Crew Assignment Import
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={handleFileChange}
        />



        {/* UPLOAD FILE DROPZONE / FILE INFO (Crew Import Style) */}
        {!file ? (
          <div
            className="flex flex-col items-center justify-center border-2 border-dashed border-[#cbd5e1] hover:border-[#5dc86f] cursor-pointer rounded-lg p-10 space-y-3 bg-[#fafcfd] transition-colors mb-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-gray-400" />
            <div className="text-center">
              <span className="text-[#3b82f6] font-medium hover:underline text-sm">Upload reviewed workbook (.xlsx)</span>
              <span className="text-gray-500 text-sm"> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-400">Excel (.xlsx) format containing 'VesselRankHierarchy' and 'Assignments' sheets</p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-lg bg-white mb-4">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-8 w-8 text-[#3b82f6]" />
              <div>
                <h4 className="text-sm font-medium text-gray-700 truncate max-w-[320px]">
                  {file.name}
                </h4>
                <p className="text-xs text-gray-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB — Reviewed Import Workbook
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={() => {
                setFile(null);
                setStage1Status("idle");
                setStage2Status("idle");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SECTION 1: VESSEL RANK HIERARCHY TAB */}
        {activeTab === "hierarchy" && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg border transition-colors ${
                stage1Status === "success"
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-[#f8fafc] border-[#e2e8f0]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-semibold text-[#2c3e50] text-sm">
                  <span className="h-6 w-6 rounded-full bg-[#3b82f6] text-white text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  Section 1 — Vessel Rank Hierarchy
                </div>
                {stage1Status === "success" && (
                  <span className="text-xs text-[#5dc86f] flex items-center gap-1 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> Published
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Imports the 'VesselRankHierarchy' sheet, commits vessel revisions, and generates vacant rank slots in Vessel Planning.
              </p>

              {stage1Result && (
                <div className="mb-3 text-xs bg-white p-3 rounded border border-[#e2e8f0] text-gray-700 space-y-1">
                  <p>• Vessels Processed: <span className="font-semibold text-gray-900">{stage1Result.vesselsProcessed}</span></p>
                  <p>• Active Rank Positions Published: <span className="font-semibold text-emerald-600">{stage1Result.activeRanksCount}</span></p>
                  {stage1Result.deletedRanksCount > 0 && (
                    <p>• Excluded / Deleted Ranks: <span className="font-semibold text-amber-600">{stage1Result.deletedRanksCount}</span></p>
                  )}
                </div>
              )}

              <Button
                disabled={!file || stage1Status === "importing"}
                onClick={handleImportHierarchy}
                className={
                  stage1Status === "success"
                    ? "border-[#cbd5e1] text-gray-700 bg-white hover:bg-gray-50"
                    : "bg-[#3b82f6] hover:bg-blue-700 text-white font-medium"
                }
                variant={stage1Status === "success" ? "outline" : "default"}
                size="sm"
              >
                {stage1Status === "importing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing Hierarchy...
                  </>
                ) : stage1Status === "success" ? (
                  "Re-import Rank Hierarchy (Section 1)"
                ) : (
                  "Import Vessel Rank Hierarchy (Section 1)"
                )}
              </Button>
            </div>

            {/* CHECKPOINT BANNER */}
            {stage1Status === "success" && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2.5">
                <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Verification Checkpoint</p>
                  <p className="text-amber-700 mt-0.5">
                    Vacant rank slots are now generated! You can switch to <strong>Section 2: Crew Assignment Import</strong> or check <strong>Vessel &gt; Planning</strong> to verify rank positions before importing crew assignments.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: CREW ASSIGNMENT IMPORT TAB */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg border transition-colors ${
                stage2Status === "success"
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-[#f8fafc] border-[#e2e8f0]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-semibold text-[#2c3e50] text-sm">
                  <span className="h-6 w-6 rounded-full bg-[#5dc86f] text-white text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  Section 2 — Crew Assignment Import
                </div>
                {stage2Status === "success" && (
                  <span className="text-xs text-[#5dc86f] flex items-center gap-1 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> Completed
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Imports the 'Assignments' sheet, assigning Primary onboard crew and Secondary relievers to position slots.
              </p>

              {stage2Result && (
                <div className="mb-3 text-xs bg-white p-3 rounded border border-[#e2e8f0] text-gray-700 space-y-1">
                  <p>• Primary Onboard Assigned: <span className="font-semibold text-emerald-600">{stage2Result.primaryAssignedCount}</span></p>
                  <p>• Secondary Relievers Assigned: <span className="font-semibold text-blue-600">{stage2Result.secondaryAssignedCount}</span></p>
                  {stage2Result.skippedCount > 0 && (
                    <p>• Skipped Rows: <span className="font-semibold text-amber-600">{stage2Result.skippedCount}</span></p>
                  )}
                  {stage2Result.errors && stage2Result.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-amber-700 max-h-24 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                      {stage2Result.errors.map((err: string, i: number) => (
                        <p key={i}>⚠️ {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                disabled={!file || stage2Status === "importing"}
                onClick={handleImportAssignments}
                className="bg-[#5dc86f] text-white hover:bg-[#218838] font-medium"
                size="sm"
              >
                {stage2Status === "importing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing Assignments...
                  </>
                ) : (
                  <>
                    Import Crew Assignments (Section 2) <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-gray-100 pt-3 mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} className="text-gray-700 border-[#cbd5e1]">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
