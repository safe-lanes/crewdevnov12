import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import type {
  AssignmentDimensionReport,
  RuleDimensionValue,
} from "@shared/v2/forms-engine/ruleDimensions";

type AssignmentDimensionInspectorProps = {
  subjectRef: string;
};

function dimensionValue(dimension: RuleDimensionValue): string {
  if (dimension.status === "unresolved") return "Unresolved";
  if (dimension.status === "not_yet_available") return "Not yet available";
  if (dimension.value === null) return dimension.labels.length ? dimension.labels.join(", ") : "No value";
  if (typeof dimension.value === "boolean") return dimension.value ? "Yes" : "No";
  if (Array.isArray(dimension.value)) {
    return dimension.labels.length ? dimension.labels.join(", ") : dimension.value.join(", ");
  }
  return dimension.labels.length ? dimension.labels.join(", ") : dimension.value;
}

export function AssignmentDimensionInspector({ subjectRef }: AssignmentDimensionInspectorProps) {
  const { permissions, userId, roleId } = usePermissions();
  const [open, setOpen] = useState(false);
  const canSeeFacts = permissions.some(p => p.menuName.trim().toLowerCase() === "forms" && p.canview === true);
  const dimensions = useQuery<AssignmentDimensionReport>({
    queryKey: ["crew-assignment-dimensions", subjectRef, userId, roleId],
    enabled: open && canSeeFacts && Boolean(subjectRef),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(subjectRef)}/dimensions`,
      );
      return (await response.json()) as AssignmentDimensionReport;
    },
  });

  if (!canSeeFacts) return null;
  return (
    <section className="overflow-hidden rounded-md border border-blue-200 bg-white">
      <button
        type="button"
        className="flex min-h-10 w-full items-center justify-between gap-3 bg-blue-50/70 px-3 py-2 text-left text-sm font-semibold text-blue-900 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={`assignment-dimensions-panel-${subjectRef}`}
        data-testid={`assignment-dimension-check-${subjectRef}`}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded border border-blue-300 bg-white text-xs">
            i
          </span>
          Form rule facts
        </span>
        <span aria-hidden="true" className="text-xs text-blue-800">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div id={`assignment-dimensions-panel-${subjectRef}`} className="border-t border-blue-200 p-3">
          {dimensions.isLoading && (
            <div role="status" aria-live="polite" className="space-y-2">
                <span className="sr-only">Loading form rule facts…</span>
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-10 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          )}

          {dimensions.error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
              <p>Form rule facts could not be loaded: {dimensions.error instanceof Error ? dimensions.error.message : "Please try again."}</p>
              <button
                type="button"
                onClick={() => void dimensions.refetch()}
                className="mt-2 rounded border border-rose-300 bg-white px-2.5 py-1 font-semibold hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                Retry
              </button>
            </div>
          )}

          {dimensions.isSuccess && dimensions.data.dimensions.length === 0 && (
            <p role="status" className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No form rule facts are available for this assignment.
            </p>
          )}

          {dimensions.isSuccess && dimensions.data.dimensions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <caption className="sr-only">Form rule facts for this assignment</caption>
                <thead>
                  <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-600">
                    <th scope="col" className="px-2 py-2 font-semibold">Form fact</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Value / status</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Availability &amp; provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {dimensions.data.dimensions.map((dimension) => {
                    const source = dimension.source ?? {};
                    const ownerFlag = Object.entries(source).some(([key, value]) =>
                      /owner|flag/i.test(key) && value !== undefined && value !== null && value !== "",
                    );
                    return (
                      <tr key={dimension.key} className="border-b border-slate-200 align-top last:border-b-0">
                        <th scope="row" className="w-[28%] px-2 py-3 font-medium text-slate-900">
                          <span className="block">{dimension.label}</span>
                        </th>
                        <td className="px-2 py-3 text-slate-800">
                          <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                            dimension.status === "resolved"
                              ? "bg-emerald-100 text-emerald-900"
                              : dimension.status === "unresolved"
                                ? "bg-amber-100 text-amber-950"
                                : "bg-slate-100 text-slate-700"
                          }`}>
                            {dimension.status === "not_yet_available" ? "Not yet available" : dimension.status === "unresolved" ? "Unresolved" : "Resolved"}
                          </span>
                          {dimension.status === "resolved" && (
                            <p className="mt-1 font-medium">{dimensionValue(dimension)}</p>
                          )}
                          {dimension.status === "unresolved" && (
                            <div className="mt-1">
                              <p>{dimension.reason || "No resolution reason was provided."}</p>
                              {dimension.labels.length > 0 && (
                                <p className="mt-1 text-xs text-slate-600">Labels: {dimension.labels.join(", ")}</p>
                              )}
                            </div>
                          )}
                          {dimension.status === "not_yet_available" && (
                            <div className="mt-1">
                              <p className="text-slate-600">{dimension.reason || "This value is not available yet."}</p>
                              {dimension.labels.length > 0 && (
                                <p className="mt-1 text-xs text-slate-600">Labels: {dimension.labels.join(", ")}</p>
                              )}
                              <p className="mt-1 text-xs text-slate-600">{ownerFlag ? "Ownership or flag information was supplied." : "No ownership or flag information was supplied."}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-slate-700">
                          <p className="font-medium text-slate-800">Available: {dimension.available ? "Yes" : "No"}</p>
                          {dimension.available === false && dimension.unavailableReason && (
                            <p className="mt-0.5 text-xs text-slate-600">{dimension.unavailableReason}</p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            {dimension.available ? "Value supplied by the assignment record." : "Value has not been supplied by the assignment record."}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">These facts explain form rules; they do not change assignment readiness.</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default AssignmentDimensionInspector;
