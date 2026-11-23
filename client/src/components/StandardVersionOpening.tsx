import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { StandardVersionOpening } from "@/lib/standardVersionOpening";
import { Button } from "@/components/ui/button";

export function VersionOpeningProblem({ message, onRetry, onClose }: {
  message: string; onRetry: () => void; onClose: () => void;
}) {
  return <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
    <div className="max-w-md rounded-lg bg-white p-6" role="alert">
      <p>{message}</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onRetry}>Retry</Button>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  </div>;
}

/** Verify list navigation before mounting an editor. Never initialize on a failed/stale lookup. */
export function StandardVersionOpeningGate({ formId, opening, children, onClose }: {
  formId: number; opening: StandardVersionOpening;
  children: React.ReactNode; onClose: () => void;
}) {
  const [verified, setVerified] = useState(false);
  const query = useQuery({
    queryKey: ["standard-version-opening", formId, opening.rankGroupId, opening.versionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/v2/admin/forms/${formId}/versions`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.some(row => !Number.isInteger(row?.id)
        || row.formId !== formId || !["draft", "released"].includes(row.status))) {
        throw new Error("Invalid version list");
      }
      const matching = rows.filter(row => row.rankGroupId === opening.rankGroupId);
      if (opening.versionId === null ? matching.length !== 0
        : !matching.some(row => row.id === opening.versionId)) {
        throw new Error("Requested version is no longer available");
      }
      return true;
    },
    retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (query.isSuccess && !query.isFetching) setVerified(true);
  }, [query.isSuccess, query.isFetching]);
  // Subsequent lifecycle changes belong to the mounted editor, not the original opening request.
  if (verified) return <>{children}</>;
  if (query.isError) return <VersionOpeningProblem
    message="The requested form version could not be opened. It may have changed or is no longer available. Retry or close and refresh the forms list."
    onRetry={() => void query.refetch()} onClose={onClose} />;
  return <div role="status" className="fixed inset-0 z-[210] flex items-center justify-center bg-white">Loading form version…</div>;
}
