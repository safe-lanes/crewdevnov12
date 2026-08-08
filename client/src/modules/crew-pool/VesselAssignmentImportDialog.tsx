import React, { useState, useRef, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";

// ── useImportProgress ─────────────────────────────────────────────────────────
// Drives a time-estimated multi-phase progress bar while a single POST is
// in flight.  Each phase specifies a display label, a target percentage (`end`),
// and how long (ms) the phase should take to animate to that target.
// The bar caps at the last phase's `end` value while the request is pending,
// then snaps to 100 % the moment `active` flips false (success or error).
// All timers are cancelled on `active → false` or component unmount so no
// state updates fire after the component is gone.

interface ImportPhase {
  label: string;
  /** Target percentage at which this phase finishes (0–100). */
  end: number;
  /** Wall-clock duration (ms) for animating from the previous phase's end to this one. */
  durationMs: number;
}

function useImportProgress(active: boolean, phases: ImportPhase[]) {
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("");
  const cancelRef = useRef<() => void>(() => {});
  const wasActiveRef = useRef(false);

  useEffect(() => {
    // Tear down any running animation first.
    cancelRef.current();

    if (!active) {
      if (wasActiveRef.current) {
        // Request returned (success or error) — snap the bar to 100 %.
        setProgress(100);
      }
      wasActiveRef.current = false;
      cancelRef.current = () => {};
      return;
    }

    wasActiveRef.current = true;
    setProgress(0);
    setPhaseLabel(phases[0]?.label ?? "");

    let cancelled = false;
    const handles: ReturnType<typeof setTimeout>[] = [];
    const TICK_MS = 80;

    let cumulativeMs = 0;
    phases.forEach((phase, idx) => {
      const startPct = idx === 0 ? 0 : phases[idx - 1].end;
      const endPct = phase.end;
      const duration = phase.durationMs;
      const phaseDelay = cumulativeMs;
      cumulativeMs += duration;

      // Schedule the label change and interval for this phase.
      const t = setTimeout(() => {
        if (cancelled) return;
        setPhaseLabel(phase.label);
        let elapsed = 0;
        const iv = setInterval(() => {
          if (cancelled) {
            clearInterval(iv);
            return;
          }
          elapsed += TICK_MS;
          const frac = Math.min(elapsed / duration, 1);
          setProgress(startPct + (endPct - startPct) * frac);
          if (frac >= 1) clearInterval(iv);
        }, TICK_MS);
        handles.push(iv as unknown as ReturnType<typeof setTimeout>);
      }, phaseDelay);
      handles.push(t);
    });

    cancelRef.current = () => {
      cancelled = true;
      handles.forEach((h) => {
        clearTimeout(h);
        clearInterval(h as unknown as ReturnType<typeof setInterval>);
      });
    };

    return () => {
      cancelRef.current();
    };
    // phases is defined at module level per call site — intentionally omitted
    // from deps to avoid restarting on re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { progress, phaseLabel };
}

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

  // ── Phase definitions ──────────────────────────────────────────────────────
  // Durations are time-estimates that fill the bar up to ~95 % while the
  // request is in flight.  The bar snaps to 100 % on response arrival.
  const STAGE1_PHASES: ImportPhase[] = [
    { label: "Reading workbook…",        end: 15, durationMs: 1200 },
    { label: "Processing vessel ranks…", end: 50, durationMs: 5000 },
    { label: "Writing planning slots…",  end: 83, durationMs: 6000 },
    { label: "Finalising…",              end: 95, durationMs: 2000 },
  ];

  const STAGE2_PHASES: ImportPhase[] = [
    { label: "Reading workbook…",          end:  8, durationMs: 1000 },
    { label: "Validating rows…",           end: 28, durationMs: 3000 },
    { label: "Matching crew to vessels…",  end: 62, durationMs: 5000 },
    { label: "Writing assignments…",       end: 90, durationMs: 7000 },
    { label: "Finalising…",               end: 97, durationMs: 2000 },
  ];

  const { progress: stage1Progress, phaseLabel: stage1PhaseLabel } =
    useImportProgress(stage1Status === "importing", STAGE1_PHASES);

  const { progress: stage2Progress, phaseLabel: stage2PhaseLabel } =
    useImportProgress(stage2Status === "importing", STAGE2_PHASES);

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
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v2/vessel/import/hierarchy", {
        method: "POST",
        body: formData,
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
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v2/vessel/import/assignments", {
        method: "POST",
        body: formData,
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

              {stage1Status === "importing" ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span className="font-medium">{stage1PhaseLabel}</span>
                    <span className="tabular-nums text-gray-400">{Math.round(stage1Progress)}%</span>
                  </div>
                  <Progress
                    value={stage1Progress}
                    className="h-2 bg-blue-100"
                  />
                </div>
              ) : (
                <Button
                  disabled={!file}
                  onClick={handleImportHierarchy}
                  className={
                    stage1Status === "success"
                      ? "border-[#cbd5e1] text-gray-700 bg-white hover:bg-gray-50"
                      : "bg-[#3b82f6] hover:bg-blue-700 text-white font-medium"
                  }
                  variant={stage1Status === "success" ? "outline" : "default"}
                  size="sm"
                >
                  {stage1Status === "success"
                    ? "Re-import Rank Hierarchy (Section 1)"
                    : "Import Vessel Rank Hierarchy (Section 1)"}
                </Button>
              )}
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

              {stage2Status === "importing" ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span className="font-medium">{stage2PhaseLabel}</span>
                    <span className="tabular-nums text-gray-400">{Math.round(stage2Progress)}%</span>
                  </div>
                  <Progress
                    value={stage2Progress}
                    className="h-2 bg-emerald-100"
                  />
                </div>
              ) : (
                <Button
                  disabled={!file}
                  onClick={handleImportAssignments}
                  className="bg-[#5dc86f] text-white hover:bg-[#218838] font-medium"
                  size="sm"
                >
                  Import Crew Assignments (Section 2) <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              )}
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
