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
import {
  Upload,
  Download,
  FileArchive,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";

interface VesselZipUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VesselZipUploadDialog({ isOpen, onClose }: VesselZipUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleClose = () => {
    setFile(null);
    setIsGenerating(false);
    setSummary(null);
    setErrorMessage(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      toast({
        variant: "destructive",
        title: "Invalid file format",
        description: "Please upload a .zip archive containing .docx crew list files.",
      });
      return;
    }

    setFile(selectedFile);
    setSummary(null);
    setErrorMessage(null);
  };

  const MAX_ZIP_BYTES = 200 * 1024 * 1024; // 200 MB — mirrors server MAX_IMPORT_BYTES

  const handleGenerateWorkbook = async () => {
    if (!file) return;

    // Client-side size guard — avoids a large upload that will be rejected anyway
    if (file.size > MAX_ZIP_BYTES) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: `The selected ZIP is ${(file.size / 1024 / 1024).toFixed(0)} MB. Maximum allowed size is 200 MB.`,
      });
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // Send as multipart/form-data — eliminates base64 inflation (~33% overhead)
      // and bypasses the global express.json({ limit: '10mb' }) gate.
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v2/vessel/import/generate-workbook", {
        method: "POST",
        // No Content-Type header — browser sets multipart boundary automatically
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate vessel import workbook");
      }

      // Fetch the blob through window.fetch (auth-patched; carries Authorization header)
      // then trigger the download via an object URL.
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vessel_crew_import.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Workbook Generated Successfully",
        description: "Downloaded 'vessel_crew_import.xlsx'. Review the 2 sheets and re-upload in Crew Pool › Import Vessel Data.",
      });

      setSummary({ success: true });
    } catch (err: any) {
      console.error("Error generating workbook:", err);
      setErrorMessage(err.message || "Failed to generate workbook");
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: err.message || "An error occurred while parsing the ZIP file.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <FileArchive className="h-5 w-5 text-blue-600" />
            Bulk Vessel Rank Hierarchy Generator (ZIP)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <p className="text-slate-600">
            Upload a single <strong>.zip archive</strong> containing client <strong>.docx crew list files</strong> (one file per vessel, formatted as IMO FAL Form 5).
          </p>

          {/* Upload Drop Area */}
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center bg-slate-50 hover:border-blue-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 text-left">
                  <FileArchive className="h-7 w-7 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                    <p className="text-slate-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB — ZIP Archive
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setSummary(null);
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-blue-500 mx-auto" />
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    Select Crew List ZIP Archive (.zip)
                  </Button>
                </div>
                <p className="text-slate-400">
                  Each .docx inside will be parsed for Vessel Name, IMO, Crew Names, Rank, and Date of Birth.
                </p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {summary && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Workbook generated and downloaded! Review the 2 sheets, make any needed edits, and re-upload in <strong>Crew Pool &gt; Import Vessel Data</strong> for final commit.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={handleClose} className="text-slate-500">
            Close
          </Button>
          <Button
            disabled={!file || isGenerating}
            onClick={handleGenerateWorkbook}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating Workbook...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> Generate &amp; Download Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
