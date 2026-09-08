import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedDateInput } from "@/components/ui/formatted-date-input";
import { useToast } from "@/hooks/use-toast";
import { sailDesignSystem, getButtonClasses } from "@/config/sailDesignSystem";

export type BriefingFixedData = { submissionUuid?: string; partA?: any; partC?: any };

const tokens = sailDesignSystem.colors;
const buttonClasses = getButtonClasses();
const read = (value: any) => value == null || value === "" ? "—" : String(value);
const displayDate = (value: any) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};
const cardStyle = { backgroundColor: tokens.cardBackground, borderColor: tokens.border, borderRadius: sailDesignSystem.components.card.borderRadius, boxShadow: sailDesignSystem.components.card.shadow };
const sectionStyle = { backgroundColor: tokens.tableHeader, borderColor: tokens.border };
const labelStyle = { color: tokens.textSecondary, fontSize: sailDesignSystem.typography.fontSize.xs };
const valueStyle = { color: tokens.textPrimary, fontSize: sailDesignSystem.typography.fontSize.sm };

function Header({ part, subtitle, completed }: { part: "A" | "C"; subtitle: string; completed: boolean }) {
  return <header className="mb-6 border-b pb-4" style={{ borderColor: tokens.headerText }}>
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-xl font-semibold" style={{ color: tokens.headerText }}>Part {part}: {part === "A" ? "Basic Information" : "Office Review"}</h2><p className="mt-1 text-sm" style={{ color: tokens.textSecondary }}>{subtitle}</p></div>
      {completed && <span className="text-xs font-semibold" style={{ color: tokens.success }}>Completed</span>}
    </div>
    <div className="mt-3 h-0.5 w-full" style={{ backgroundColor: tokens.headerText }} />
  </header>;
}
function ReadOnlyField({ label, value }: { label: string; value: any }) {
  return <div className="rounded-md border px-3 py-2" style={sectionStyle}><label className="block font-medium" style={labelStyle}>{label}</label><p className="mt-1" style={valueStyle}>{read(value)}</p></div>;
}

export function BriefingPartA({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const [record, setRecord] = useState(data);
  const [draft, setDraft] = useState({ date: data?.date_of_briefing || "", mode: data?.mode_of_briefing || "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => setRecord(data), [data]);
  useEffect(() => setDraft({ date: record?.date_of_briefing || "", mode: record?.mode_of_briefing || "" }), [record]);
  const save = async () => { setSaving(true); try { await apiRequest("PUT", `/api/v2/briefings/submissions/${submissionUuid}/part-a`, { dateOfBriefing: draft.date || null, modeOfBriefing: draft.mode || null }); onSaved?.(); toast({ title: "Part A saved", description: "The Briefing date and mode have been recorded." }); } catch (error) { toast({ title: "Part A could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" }); } finally { setSaving(false); } };
  return <section className="rounded-lg border p-6" style={cardStyle} data-testid="briefing-part-a">
    <Header part="A" subtitle="Reference data for this briefing" completed={completed} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ReadOnlyField label="Crew member" value={record?.seafarer_name} /><ReadOnlyField label="Vessel" value={record?.vessel_name} /><ReadOnlyField label="Joining rank" value={record?.rank} /><ReadOnlyField label="Nationality" value={record?.nationality} /><ReadOnlyField label="Sign-on date" value={record?.sign_on_date} />
      <label className="block font-medium" style={labelStyle}>Briefing date{completed ? <div className="mt-1 rounded-md border px-3 py-2" style={{ ...sectionStyle, ...valueStyle }}>{displayDate(draft.date)}</div> : <FormattedDateInput value={draft.date} onChange={e => setDraft(v => ({ ...v, date: e.target.value }))} className="mt-1" data-testid="input-briefing-part-a-date" />}</label>
      <label className="block font-medium" style={labelStyle}>Mode<Select disabled={completed} value={draft.mode} onValueChange={mode => setDraft(v => ({ ...v, mode }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Select mode" /></SelectTrigger><SelectContent><SelectItem value="company_office">Company Office</SelectItem><SelectItem value="manning_agent">Manning Agent's Office</SelectItem><SelectItem value="video_call">Video Call</SelectItem></SelectContent></Select></label>
    </div>
    {!completed && <div className="mt-6 flex justify-end"><Button size="sm" className={buttonClasses.primary} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Part A"}</Button></div>}
  </section>;
}

export function BriefingPartC({ submissionUuid, data, completed, onSaved }: { submissionUuid: string; data?: any; completed: boolean; onSaved?: () => void }) {
  const { userType } = usePermissions();
  const [record, setRecord] = useState(data);
  const [comments, setComments] = useState(data?.office_review_comments || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => setRecord(data), [data]); useEffect(() => setComments(record?.office_review_comments || ""), [record]);
  if (userType?.toLowerCase() !== "office") return null;
  const save = async () => { setSaving(true); try { await apiRequest("PUT", `/api/v2/briefings/submissions/${submissionUuid}/part-c`, { officeReviewComments: comments || null }); onSaved?.(); toast({ title: "Office review saved", description: "The reviewer details have been recorded." }); } catch (error) { toast({ title: "Office review could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" }); } finally { setSaving(false); } };
  return <section className="rounded-lg border p-6" style={cardStyle} data-testid="briefing-part-c"><Header part="C" subtitle="Internal review record" completed={completed} /><div className="rounded-md border p-4" style={sectionStyle}><Textarea disabled={completed} value={comments} onChange={e => setComments(e.target.value)} placeholder="Add reviewer comments…" rows={5} className="bg-transparent" /></div><div className="mt-4 flex items-center justify-between gap-4 text-xs" style={{ color: tokens.textSecondary }}><span>{record?.office_reviewed_by_name ? `Reviewed by ${record.office_reviewed_by_name}` : "Not yet reviewed"}{record?.office_reviewed_at ? ` · ${displayDate(record.office_reviewed_at)}` : ""}</span>{!completed && <Button size="sm" className={buttonClasses.primary} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save review"}</Button>}</div></section>;
}
export function briefingFixedParts(submissionUuid: string, data: BriefingFixedData, completed: boolean, onSaved: () => void): Record<string, React.ReactNode> { return { A: <BriefingPartA submissionUuid={submissionUuid} data={data.partA} completed={completed} onSaved={onSaved} />, C: <BriefingPartC submissionUuid={submissionUuid} data={data.partC} completed={completed} onSaved={onSaved} /> }; }