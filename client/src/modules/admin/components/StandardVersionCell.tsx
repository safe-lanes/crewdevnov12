import React from "react";
import { type ListVersion, storedStandardVersion } from "../formsListVersions";
import { Button } from "@/components/ui/button";

export function standardRowVersions(versions: ListVersion[], rankGroupId: number | null) {
  const primary = storedStandardVersion(versions, rankGroupId);
  const draft = versions.filter(v => v.rankGroupId === rankGroupId && v.status === "draft")
    .sort((a, b) => Number(b.versionNo) - Number(a.versionNo) || b.id - a.id)[0];
  return { primary, draft: draft?.id === primary?.id ? undefined : draft };
}

export function StandardVersionCell({ versions, rankGroupId, onOpenDraft, readOnly = false }: {
  versions: ListVersion[]; rankGroupId: number | null;
  onOpenDraft: (version: ListVersion) => void; readOnly?: boolean;
}) {
  const { primary, draft } = standardRowVersions(versions, rankGroupId);
  const label = (version: ListVersion) => <span className="inline-flex items-center gap-1">
    <span>v{version.versionNo}</span>
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${version.status === "draft"
      ? "border-blue-200 bg-blue-100 text-blue-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{version.status === "draft" ? "Draft" : "Released"}</span>
  </span>;
  return <div className="flex flex-col items-start gap-1">
    {primary ? label(primary) : <span>v00 · Not initialized</span>}
    {draft && <div className="flex flex-wrap items-center gap-1">
      {label(draft)}
      <Button variant="ghost" size="sm" className="h-6 px-1 text-xs"
        disabled={readOnly} onClick={() => onOpenDraft(draft)}>Open Draft</Button>
    </div>}
  </div>;
}
