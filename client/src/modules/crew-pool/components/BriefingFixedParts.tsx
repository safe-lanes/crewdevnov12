import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedDateInput } from "@/components/ui/formatted-date-input";
import { useToast } from "@/hooks/use-toast";

export type BriefingFixedData = { submissionUuid?: string; partA?: any; partC?: any };

const read = (value: any) => value == null || value === "" ? "—" : String(value);
const displayDate = (value: any) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};

export function BriefingPartA({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const [record, setRecord] = useState(data);
  const [draft, setDraft] = useState({ date: data?.date_of_briefing || "", mode: data?.mode_of_briefing || "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const complete = completed;
  useEffect(() => { setRecord(data); }, [data]);
  useEffect(() => setDraft({ date: record?.date_of_briefing || "", mode: record?.mode_of_briefing || "" }), [record]);
  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/v2/briefings/submissions/${submissionUuid}/part-a`, {
        dateOfBriefing: draft.date || null,
        modeOfBriefing: draft.mode || null,
      });
      onSaved?.();
      toast({ title: "Part A saved", description: "The Briefing date and mode have been recorded." });
    } catch (error) {
      toast({ title: "Part A could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
    finally { setSaving(false); }
  };
  return <section className="rounded-md border bg-card p-5" data-testid="briefing-part-a">
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Part A · Briefing reference</h2><p className="text-xs text-muted-foreground">Reference data for this briefing</p></div>{complete && <span className="text-xs font-medium text-emerald-700">Completed</span>}</div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-md bg-muted/50 px-3 py-2"><label className="text-xs font-medium text-muted-foreground">Crew member</label><p className="mt-1 text-sm">{read(record?.seafarer_name)}</p></div>
      <div className="rounded-md bg-muted/50 px-3 py-2"><label className="text-xs font-medium text-muted-foreground">Vessel</label><p className="mt-1 text-sm">{read(record?.vessel_name)}</p></div>
      <div className="rounded-md bg-muted/50 px-3 py-2"><label className="text-xs font-medium text-muted-foreground">Joining rank</label><p className="mt-1 text-sm">{read(record?.rank)}</p></div>
      <div className="rounded-md bg-muted/50 px-3 py-2"><label className="text-xs font-medium text-muted-foreground">Nationality</label><p className="mt-1 text-sm">{read(record?.nationality)}</p></div>
      <div className="rounded-md bg-muted/50 px-3 py-2"><label className="text-xs font-medium text-muted-foreground">Sign-on date</label><p className="mt-1 text-sm">{read(record?.sign_on_date)}</p></div>
      <label className="text-xs font-medium text-muted-foreground">
        Briefing date
        {complete ? (
          <div className="mt-1 h-9 rounded-md border bg-muted/50 px-3 py-2 text-sm text-foreground">{displayDate(draft.date)}</div>
        ) : (
          <FormattedDateInput value={draft.date} onChange={e => setDraft(v => ({ ...v, date: e.target.value }))} className="mt-1" data-testid="input-briefing-part-a-date" />
        )}
      </label>
      <label className="text-xs font-medium text-muted-foreground">Mode<Select disabled={complete} value={draft.mode} onValueChange={mode => setDraft(v => ({ ...v, mode }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Select mode" /></SelectTrigger><SelectContent><SelectItem value="company_office">Company Office</SelectItem><SelectItem value="manning_agent">Manning Agent's Office</SelectItem><SelectItem value="video_call">Video Call</SelectItem></SelectContent></Select></label>
    </div>
    {!complete && <div className="mt-4 flex justify-end"><Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Part A"}</Button></div>}
  </section>;
}

export function BriefingPartC({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const { userType } = usePermissions();
  const [record, setRecord] = useState(data);
  const [comments, setComments] = useState(data?.office_review_comments || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const complete = completed;
  useEffect(() => { setRecord(data); }, [data]);
  useEffect(() => setComments(record?.office_review_comments || ""), [record]);
  if (userType?.toLowerCase() !== "office") return null;
  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/v2/briefings/submissions/${submissionUuid}/part-c`, { officeReviewComments: comments || null });
      onSaved?.();
      toast({ title: "Office review saved", description: "The reviewer details have been recorded." });
    } catch (error) {
      toast({ title: "Office review could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setSaving(false); }
  };
  return <section className="rounded-md border bg-card p-5" data-testid="briefing-part-c">
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Part C · Office review</h2><p className="text-xs text-muted-foreground">Internal review record</p></div>{complete && <span className="text-xs font-medium text-emerald-700">Completed</span>}</div>
    <Textarea disabled={complete} value={comments} onChange={e => setComments(e.target.value)} placeholder="Add reviewer comments…" rows={5} />
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{record?.office_reviewed_by_name ? `Reviewed by ${record.office_reviewed_by_name}` : "Not yet reviewed"}{record?.office_reviewed_at ? ` · ${displayDate(record.office_reviewed_at)}` : ""}</span>{!complete && <Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save review"}</Button>}</div>
  </section>;
}