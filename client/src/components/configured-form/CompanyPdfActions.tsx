import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Download, Printer, RefreshCw } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

type PdfStatus = "disabled" | "pending" | "ready" | "failed" | "unavailable";
interface HandoverRecord {
  actorName: string;
  recordedAt: string;
  fileSha256: string;
}
interface CompanyPdfStatus {
  status: PdfStatus;
  message: string;
  fileSha256?: string;
  frozenRecordSha256?: string;
  documentReference?: string | null;
  canRetry: boolean;
  canFillIn: boolean;
  handovers: HandoverRecord[];
}

const statusMessages: Record<PdfStatus, string> = {
  disabled: "PDF generation for real forms is disabled until the sample layout is approved.",
  pending: "Your PDF is being prepared. Check again shortly.",
  ready: "Your PDF is ready to download or print.",
  failed: "The PDF could not be prepared. Retry the request or contact your administrator.",
  unavailable: "A PDF copy is not available for this form. Ask the office to review its saved evidence.",
};

function formatRecordedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CompanyPdfActions({
  submissionUuid,
  completed,
  canFillIn,
  onChanged,
}: {
  submissionUuid: string;
  completed: boolean;
  canFillIn: boolean;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [working, setWorking] = useState<"retry" | "handover" | "download" | "print" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const statusKey = ["company-form-pdf-status", submissionUuid];
  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/v2/company-form-submissions/${encodeURIComponent(submissionUuid)}/pdf/status`,
      );
      return await response.json() as CompanyPdfStatus;
    },
    enabled: Boolean(submissionUuid && completed),
    retry: false,
    staleTime: 0,
    refetchInterval: query => query.state.data?.status === "pending" ? 3000 : false,
  });
  const status = statusQuery.data;
  const refreshAfterAction = async () => {
    await queryClient.invalidateQueries({ queryKey: statusKey });
    onChanged?.();
  };
  const runAction = async (
    kind: "retry" | "handover",
    action: () => Promise<void>,
  ) => {
    setWorking(kind);
    setActionError(null);
    try {
      await action();
      await refreshAfterAction();
    } catch {
      setActionError(kind === "retry"
        ? "The retry request could not be completed. Please try again."
        : "The handover could not be recorded. Please try again.");
    } finally {
      setWorking(null);
    }
  };
  const fetchDocument = async (mode: "download" | "print") => {
    // Open synchronously in the click handler so the browser treats printing as
    // a user-initiated action rather than a popup.
    const printWindow = mode === "print" ? window.open("", "_blank") : null;
    if (mode === "print" && !printWindow) {
      setActionError("Allow pop-ups for this site, then select Print again.");
      return;
    }
    setWorking(mode);
    setActionError(null);
    try {
      const response = await apiRequest(
        "GET",
        `/api/v2/company-form-submissions/${encodeURIComponent(submissionUuid)}/pdf`,
      );
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (mode === "download") {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `company-form-${submissionUuid}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else if (printWindow) {
        printWindow.location.href = objectUrl;
      }
    } catch {
      printWindow?.close();
      setActionError(mode === "print"
        ? "The PDF could not be opened for printing. Please try again."
        : "The PDF could not be downloaded. Please try again.");
    } finally {
      setWorking(null);
    }
  };
  const retry = () => runAction("retry", async () => {
    await apiRequest(
      "POST",
      `/api/v2/company-form-submissions/${encodeURIComponent(submissionUuid)}/pdf/retry`,
      {},
    );
  });
  const handover = () => {
    if (!status?.fileSha256 || !window.confirm("Record that this PDF was handed to the seafarer?")) return;
    return runAction("handover", async () => {
      await apiRequest(
        "POST",
        `/api/v2/company-form-submissions/${encodeURIComponent(submissionUuid)}/pdf/handover`,
        { fileSha256: status.fileSha256 },
      );
    });
  };

  if (!completed) {
    return <p className="text-sm text-muted-foreground">Complete this form before requesting its PDF.</p>;
  }
  if (statusQuery.isPending) {
    return <div className="h-8 w-48 animate-pulse rounded bg-muted" role="status" aria-label="Checking PDF status" />;
  }
  if (statusQuery.error) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <span>PDF status could not be loaded.</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void statusQuery.refetch()}>
          Check again
        </Button>
      </div>
    );
  }
  const currentStatus = status?.status ?? "unavailable";

  return (
    <section className="space-y-3" aria-label="Company PDF">
      {status?.documentReference && <p className="text-sm">Document reference: {status.documentReference}</p>}
      <p className="text-sm text-muted-foreground" role="status">{statusMessages[currentStatus]}</p>
      {actionError && <p className="text-sm text-destructive" role="alert">{actionError}</p>}
      <div className="flex flex-wrap gap-2">
        {currentStatus === "ready" && (
          <>
            <Button type="button" size="sm" onClick={() => void fetchDocument("download")} disabled={working !== null}>
              <Download aria-hidden="true" /> {working === "download" ? "Preparing…" : "Download"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void fetchDocument("print")} disabled={working !== null}>
              <Printer aria-hidden="true" /> {working === "print" ? "Opening…" : "Print copy"}
            </Button>
            {canFillIn && status?.canFillIn && (
              <Button type="button" size="sm" variant="outline" onClick={() => void handover()} disabled={working !== null}>
                <Check aria-hidden="true" /> {working === "handover" ? "Recording…" : "Copy handed to seafarer"}
              </Button>
            )}
          </>
        )}
        {status?.canRetry && (
          <Button type="button" size="sm" variant="outline" onClick={() => void retry()} disabled={working !== null}>
            <RefreshCw aria-hidden="true" /> {working === "retry" ? "Requesting…" : "Retry PDF"}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void statusQuery.refetch()}
          disabled={working !== null || statusQuery.isFetching}
        >
          Check status
        </Button>
      </div>
      {(status?.handovers?.length ?? 0) > 0 && (
        <div className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-medium">Handover records</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {status?.handovers.map((record, index) => (
              <li key={`${record.recordedAt}-${record.fileSha256}-${index}`}>
                <span className="font-medium text-foreground">{record.actorName || "A user"}</span>
                {" · "}{formatRecordedAt(record.recordedAt)}
                <span className="sr-only"> · PDF checksum {record.fileSha256}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
