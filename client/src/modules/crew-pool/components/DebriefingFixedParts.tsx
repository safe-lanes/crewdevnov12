import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedDateInput } from "@/components/ui/formatted-date-input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";

export type DebriefingFixedData = { partA?: any; partC?: any };

export const readDebriefingValue = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "—" : String(value);

export const formatDebriefingDate = (value: unknown): string => {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};

export const debriefingModeLabel = (value: unknown): string =>
  ({ company_office: "Company Office", manning_agent: "Manning Agent's Office", video_call: "Video Call" } as Record<string, string>)[String(value)] || readDebriefingValue(value);
export const buildDebriefingPartAPayload = (date: string, mode: string) => ({
  debriefingDate: date || null,
  modeOfDebriefing: mode || null,
});
export const buildDebriefingPartCPayload = (comments: string) => ({
  officeReviewComments: comments || null,
});

export function DebriefingPartA({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const [record, setRecord] = useState(data);
  const [draft, setDraft] = useState({ date: data?.debriefing_date || "", mode: data?.mode_of_debriefing || "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => setRecord(data), [data]);
  useEffect(() => setDraft({ date: record?.debriefing_date || "", mode: record?.mode_of_debriefing || "" }), [record]);
  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/v2/debriefings/submissions/${submissionUuid}/part-a`, buildDebriefingPartAPayload(draft.date, draft.mode));
      onSaved?.();
      toast({ title: "Part A saved", description: "The debriefing date and mode have been recorded." });
    } catch (error) {
      toast({ title: "Part A could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setSaving(false); }
  };
  return <section className="rounded-md border bg-card p-5" data-testid="debriefing-part-a">
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Part A · Debriefing reference</h2><p className="text-xs text-muted-foreground">Source details are read-only; complete the debriefing record below.</p></div>{completed && <span className="text-xs font-medium text-emerald-700">Completed</span>}</div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {([["Crew member", record?.seafarer_name], ["Nationality", record?.nationality], ["Vessel", record?.vessel_name], ["Rank Served", record?.rank_served], ["Date Signed On", formatDebriefingDate(record?.sign_on_date)], ["Date Signed Off", formatDebriefingDate(record?.sign_off_date)], ["Reason for Sign Off", record?.reason_for_sign_off]] as [string, unknown][]).map(([label, value]) => <div key={label} className="rounded-md bg-muted/50 px-3 py-2"><label className="text-xs font-medium text-muted-foreground">{label}</label><p className="mt-1 text-sm">{readDebriefingValue(value)}</p></div>)}
      <label className="text-xs font-medium text-muted-foreground">Debriefing Date{completed ? <div className="mt-1 h-9 rounded-md border bg-muted/50 px-3 py-2 text-sm text-foreground">{formatDebriefingDate(draft.date)}</div> : <FormattedDateInput value={draft.date} onChange={e => setDraft(v => ({ ...v, date: e.target.value }))} className="mt-1" data-testid="input-debriefing-date" />}</label>
      <label className="text-xs font-medium text-muted-foreground">Mode of Debriefing<Select disabled={completed} value={draft.mode} onValueChange={mode => setDraft(v => ({ ...v, mode }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Select mode" /></SelectTrigger><SelectContent><SelectItem value="company_office">Company Office</SelectItem><SelectItem value="manning_agent">Manning Agent's Office</SelectItem><SelectItem value="video_call">Video Call</SelectItem></SelectContent></Select></label>
    </div>
    {!completed && <div className="mt-4 flex justify-end"><Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Part A"}</Button></div>}
  </section>;
}

export function DebriefingPartC({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const { userType } = usePermissions();
  const [record, setRecord] = useState(data);
  const [comments, setComments] = useState(data?.office_review_comments || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => setRecord(data), [data]);
  useEffect(() => setComments(record?.office_review_comments || ""), [record]);
  if (userType?.toLowerCase() !== "office") return null;
  const save = async () => {
    setSaving(true);
    try { await apiRequest("PUT", `/api/v2/debriefings/submissions/${submissionUuid}/part-c`, buildDebriefingPartCPayload(comments)); onSaved?.(); toast({ title: "Office review saved", description: "The reviewer details have been recorded." }); }
    catch (error) { toast({ title: "Office review could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return <section className="rounded-md border bg-card p-5" data-testid="debriefing-part-c">
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Part C · Office review</h2><p className="text-xs text-muted-foreground">Internal review record</p></div>{completed && <span className="text-xs font-medium text-emerald-700">Completed</span>}</div>
    <Textarea disabled={completed} value={comments} onChange={e => setComments(e.target.value)} placeholder="Add reviewer comments…" rows={5} />
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{record?.office_reviewed_by_name ? `Reviewed by ${record.office_reviewed_by_name}` : "Not yet reviewed"}{record?.office_reviewed_at ? ` · ${formatDebriefingDate(record.office_reviewed_at)}` : ""}</span>{!completed && <Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save review"}</Button>}</div>
  </section>;
}

export function debriefingFixedParts(submissionUuid: string, data: DebriefingFixedData, completed: boolean, onSaved: () => void): Record<string, React.ReactNode> {
  return { A: <DebriefingPartA submissionUuid={submissionUuid} data={data.partA} completed={completed} onSaved={onSaved} />, C: <DebriefingPartC submissionUuid={submissionUuid} data={data.partC} completed={completed} onSaved={onSaved} /> };
}