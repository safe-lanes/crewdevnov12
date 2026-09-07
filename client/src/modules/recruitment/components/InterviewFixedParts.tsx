import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const read = (value: unknown) => value == null || value === "" ? "—" : String(value);
const date = (value: unknown) => {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};

export function InterviewPartA({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const [draft, setDraft] = useState({ category: data?.interview_category || "", stage: data?.interview_stage || "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => setDraft({ category: data?.interview_category || "", stage: data?.interview_stage || "" }), [data]);
  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/v2/interviews/submissions/${submissionUuid}/part-a`, { interviewCategory: draft.category || null, interviewStage: draft.stage || null });
      onSaved?.(); toast({ title: "Part A saved", description: "Interview classification has been recorded." });
    } catch (error) { toast({ title: "Part A could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return <section className="rounded-md border bg-card p-5" data-testid="interview-part-a">
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Part A · Interview record</h2><p className="text-xs text-muted-foreground">B6 context is authoritative and read-only.</p></div>{completed && <span className="text-xs font-medium text-emerald-700">Completed</span>}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {([["Candidate", data?.candidate_name, "candidate"], ["Rank applied for", data?.rank, "rank"], ["Nationality", data?.nationality, "nationality"], ["Interview date", date(data?.interview_date), "date"], ["Interviewer", data?.interviewer_name, "interviewer"]] as const).map(([label, value, key]) => <div key={label} className="rounded-md bg-muted/50 px-3 py-2" data-testid={`interview-part-a-${key}`}><label className="text-xs font-medium text-muted-foreground">{label}</label><p className="mt-1 text-sm">{read(value)}</p></div>)}
      <label className="text-xs font-medium text-muted-foreground">Interview category<Input data-testid="input-interview-category" disabled={completed} value={draft.category} onChange={e => setDraft(v => ({ ...v, category: e.target.value }))} className="mt-1" placeholder="Category" /></label>
      <label className="text-xs font-medium text-muted-foreground">Interview stage<Input data-testid="input-interview-stage" disabled={completed} value={draft.stage} onChange={e => setDraft(v => ({ ...v, stage: e.target.value }))} className="mt-1" placeholder="Stage" /></label>
    </div>
    {!completed && <div className="mt-4 flex justify-end"><Button data-testid="button-save-interview-part-a" size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Part A"}</Button></div>}
  </section>;
}

export function InterviewPartC({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const [comments, setComments] = useState(data?.interviewer_comments || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => setComments(data?.interviewer_comments || ""), [data]);
  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/v2/interviews/submissions/${submissionUuid}/part-c`, { interviewerComments: comments || null });
      onSaved?.(); toast({ title: "Office review saved", description: "Interview comments have been recorded." });
    } catch (error) { toast({ title: "Office review could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return <section className="rounded-md border bg-card p-5" data-testid="interview-part-c">
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Part C · Office review</h2><p className="text-xs text-muted-foreground">B6 outcome is read-only; office notes are editable.</p></div>{completed && <span className="text-xs font-medium text-emerald-700">Completed</span>}</div>
    <div className="mb-4 grid gap-3 sm:grid-cols-2"><div className="rounded-md bg-muted/50 px-3 py-2" data-testid="interview-part-c-status"><label className="text-xs font-medium text-muted-foreground">B6 status</label><p className="mt-1 text-sm">{read(data?.status)}</p></div><div className="rounded-md bg-muted/50 px-3 py-2" data-testid="interview-part-c-result"><label className="text-xs font-medium text-muted-foreground">B6 result</label><p className="mt-1 text-sm">{read(data?.result)}</p></div></div>
    <Textarea data-testid="textarea-interview-office-comments" disabled={completed} value={comments} onChange={e => setComments(e.target.value)} placeholder="Add office review comments…" rows={5} />
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span data-testid="interview-office-review-audit">{data?.office_reviewed_by_name ? `Reviewed by ${data.office_reviewed_by_name}` : "Not yet reviewed"}{data?.office_reviewed_at ? ` · ${date(data.office_reviewed_at)}` : ""}</span>{!completed && <Button data-testid="button-save-interview-part-c" size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save review"}</Button>}</div>
  </section>;
}

export function interviewFixedParts(submissionUuid: string, data: any, completed: boolean, onSaved: () => void): Record<string, React.ReactNode> {
  return { A: <InterviewPartA submissionUuid={submissionUuid} data={data?.partA} completed={completed} onSaved={onSaved} />, C: <InterviewPartC submissionUuid={submissionUuid} data={data?.partC} completed={completed} onSaved={onSaved} /> };
}