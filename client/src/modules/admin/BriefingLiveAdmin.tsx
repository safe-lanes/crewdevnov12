import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfiguredFormRenderer, type ConfiguredFormAnswerValue, type ConfiguredFormSection } from "@/components/configured-form/ConfiguredFormRenderer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrewListV2 } from "@/modules/crew-pool/hooks/useCrewPoolV2";
import { useVesselsV2 } from "@/hooks/v2/useMasterDataV2";
import { usePermissions } from "@/contexts/PermissionsContext";
import { apiRequest } from "@/lib/queryClient";

const BASE = "/api/v2/briefings";
export type Ownership = { ownerLabel: string; canEdit: boolean };
export const ownershipFor = (section: Pick<ConfiguredFormSection, "responsible_mode" | "responsible_role_uuid" | "responsible_department">, actor: { roleName: string | null; roleId: string | null; userType: string | null }): Ownership => {
  const isAdmin = actor.roleName?.trim().toLowerCase() === "admin";
  if (isAdmin) return { ownerLabel: "Administrator", canEdit: true };
  if (section.responsible_mode === "not_applicable") return { ownerLabel: "Any authenticated user", canEdit: true };
  if (section.responsible_mode === "role") return section.responsible_role_uuid === actor.roleId
    ? { ownerLabel: actor.roleName || "Your assigned role", canEdit: true }
    : { ownerLabel: "Assigned role (not your role)", canEdit: false };
  return { ownerLabel: section.responsible_department ? `Department: ${section.responsible_department} (identity unavailable)` : "Department owner not configured", canEdit: false };
};
async function getJson(url: string) {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}
const crewName = (crew: any) => crew.fullName || crew.fullname || [crew.firstName, crew.lastName || crew.familyName].filter(Boolean).join(" ") || crew.name || crew.crewUuid;
const crewRank = (crew: any) => String(crew.presentRank || "").trim();
const layout = (section: any, questions: any[]) => {
  const optionIds = new Set(questions.map(q => q.option_set_uuid || section.default_option_set_uuid || ""));
  const options = questions[0]?.options || [];
  const eligible = questions.length > 0 && questions.every(q => ["single_select", "multi_select"].includes(q.response_type)) && optionIds.size === 1 && !!optionIds.values().next().value && options.length > 0 && options.length <= 12 && (options.length <= 6 || options.every((o: any) => o.option_label.trim().length <= 4));
  return section.layout_preference === "list" || !eligible ? "list" : "matrix";
};

/** Explicitly temporary, Office-only integration surface for the Briefing API. */
export default function BriefingLiveAdmin() {
  const queryClient = useQueryClient();
  const { roleName, roleId, userType } = usePermissions();
  const { data: crew = [], error: crewError } = useCrewListV2();
  const { data: vessels = [], error: vesselError } = useVesselsV2();
  const [crewUuid, setCrewUuid] = useState(""); const [vesselUuid, setVesselUuid] = useState(""); const [formUuid, setFormUuid] = useState(""); const [submissionUuid, setSubmissionUuid] = useState("");
  const [draftAnswers, setDraftAnswers] = useState<Record<string, ConfiguredFormAnswerValue>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string | null>>({});
  const [draftSectionComments, setDraftSectionComments] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const draftAnswersRef = useRef(draftAnswers);
  const draftCommentsRef = useRef(draftComments);
  const draftSectionCommentsRef = useRef(draftSectionComments);
  const pending = useRef(new Map<string, {
    answers: Record<string, { value: ConfiguredFormAnswerValue | null; comment: string | null }>;
    sectionComment: string | null;
  }>());
  const timer = useRef<number>();
  const formsQuery = useQuery<any[]>({ queryKey: ["/api/v2/admin/forms"], queryFn: () => getJson("/api/v2/admin/forms") });
  const listQuery = useQuery<any[]>({ queryKey: [BASE, "list", crewUuid], queryFn: () => getJson(`${BASE}/submissions/crew/${crewUuid}`), enabled: !!crewUuid });
  const readQuery = useQuery<any>({ queryKey: [BASE, submissionUuid], queryFn: () => getJson(`${BASE}/submissions/${submissionUuid}`), enabled: !!submissionUuid });
  const resolutionQuery = useQuery<any>({
    queryKey: [BASE, "resolve-creation", crewUuid, formUuid],
    queryFn: () => getJson(`${BASE}/resolve-creation?${new URLSearchParams({ crewUuid, formUuid })}`),
    enabled: !!crewUuid && !!formUuid,
    retry: false,
  });
  const selectedVessel = vessels.find((v: any) => (v.vesselUuid || v.uuid) === vesselUuid);
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${BASE}/submissions`, { formUuid, crewUuid, vesselUuid: vesselUuid || null, vesselTypeUuid: selectedVessel?.vtUuid || selectedVessel?.vtuid || selectedVessel?.vesselTypeUuid || null })).json(),
    onSuccess: x => { setSubmissionUuid(x.briefing_submission_uuid); void queryClient.invalidateQueries({ queryKey: [BASE, "list", crewUuid] }); },
  });
  const flush = async () => {
    if (!pending.current.size || !readQuery.data) return;
    const batch = [...pending.current.entries()]; pending.current.clear(); setSaveState("saving");
    try {
      for (const [sectionUuid, item] of batch) {
        const answers = Object.entries(item.answers).map(([questionUuid, answer]) => ({
          questionUuid,
          value: answer.value,
          comment: answer.comment,
        }));
        await apiRequest("PUT", `${BASE}/submissions/${submissionUuid}/sections/${sectionUuid}/answers`, {
          answers,
          sectionComment: item.sectionComment,
        });
      }
      setSaveState("saved"); void queryClient.invalidateQueries({ queryKey: [BASE, submissionUuid] });
    } catch (error) { batch.forEach(([key, value]) => pending.current.set(key, value)); setSaveState("error"); }
  };
  const queueQuestion = (questionUuid: string, value: ConfiguredFormAnswerValue | null, comment: string | null) => {
    const sectionUuid = readQuery.data?.structure.questions.find((q: any) => q.question_uuid === questionUuid)?.section_uuid;
    if (!sectionUuid) return;
    const section = pending.current.get(sectionUuid) || {
      answers: {},
      sectionComment: draftSectionCommentsRef.current[sectionUuid] ?? null,
    };
    section.answers[questionUuid] = { value, comment };
    pending.current.set(sectionUuid, section);
    setSaveState("saving");
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void flush(); }, 600);
  };
  const queueSectionComment = (sectionUuid: string, sectionComment: string) => {
    const section = pending.current.get(sectionUuid) || { answers: {}, sectionComment: null };
    section.sectionComment = sectionComment;
    pending.current.set(sectionUuid, section);
    setSaveState("saving");
    window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void flush(); }, 600);
  };
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  useEffect(() => {
    draftAnswersRef.current = {};
    draftCommentsRef.current = {};
    draftSectionCommentsRef.current = {};
    setDraftAnswers({}); setDraftComments({}); setDraftSectionComments({}); pending.current.clear();
  }, [submissionUuid]);
  useEffect(() => {
    if (!readQuery.data || pending.current.size) return;
    const answers: Record<string, ConfiguredFormAnswerValue> = {}, comments: Record<string, string | null> = {};
    readQuery.data.answers.forEach((answer: any) => { try { answers[answer.question_uuid] = JSON.parse(answer.answer_value); } catch { answers[answer.question_uuid] = answer.answer_value; } comments[answer.question_uuid] = answer.answer_comment; });
    const sectionComments = Object.fromEntries(readQuery.data.section_states.map((state: any) => [state.section_uuid, state.section_comment || ""]));
    draftAnswersRef.current = answers;
    draftCommentsRef.current = comments;
    draftSectionCommentsRef.current = sectionComments;
    setDraftAnswers(answers); setDraftComments(comments);
    setDraftSectionComments(sectionComments);
  }, [readQuery.data]);
  const model = useMemo(() => {
    const data = readQuery.data; if (!data) return null;
    const options = new Map<string, any[]>(), grouped = new Map<string, any[]>();
    data.structure.options.forEach((o: any) => options.set(o.option_set_uuid, [...(options.get(o.option_set_uuid) || []), o]));
    data.structure.questions.forEach((q: any) => grouped.set(q.section_uuid, [...(grouped.get(q.section_uuid) || []), { ...q, options: options.get(q.option_set_uuid) || [] }]));
    const sections: ConfiguredFormSection[] = data.structure.sections.map((s: any) => { const qs = grouped.get(s.section_uuid) || []; return { ...s, applicable_vessel_types: (() => { try { return JSON.parse(s.applicable_vessel_types || "[]"); } catch { return []; } })(), questions: qs, effectiveLayout: layout(s, qs) }; });
    const states = Object.fromEntries(data.section_states.map((s: any) => [s.section_uuid, { status: s.status, sectionComment: s.section_comment, submittedByName: s.submitted_by_name, submittedAt: s.submitted_at, signatureAttUuid: s.signature_att_uuid, signatureName: s.signature_name, signatureUrl: s.signature_att_uuid ? `${BASE}/signatures/${s.signature_att_uuid}/raw` : null }]));
    const ownership = Object.fromEntries(sections.map(s => [s.section_uuid!, ownershipFor(s, { roleName, roleId, userType })]));
    return { sections, states, ownership, submission: data.submission };
  }, [readQuery.data, roleName, roleId, userType]);
  const briefingForms = (formsQuery.data || []).filter((form: any) => String(form.category || form.formCategory || "").toLowerCase() === "briefing");
  const errors = [formsQuery.error, crewError, vesselError, listQuery.error, readQuery.error, create.error].filter(Boolean);
  return <div className="space-y-5" data-testid="temporary-admin-briefings">
    <header><h1 className="text-xl font-semibold">Temporary Office-only: Live Briefing submissions</h1><p className="text-sm text-muted-foreground">This temporary integration uses the released Briefing API. Section authorization remains server-enforced.</p></header>
    {errors.map((error, i) => <p key={i} className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>)}
    <div className="grid gap-3 md:grid-cols-4">
      <Select value={crewUuid} onValueChange={setCrewUuid}><SelectTrigger><SelectValue placeholder="Choose crew" /></SelectTrigger><SelectContent>{crew.map((c: any) => <SelectItem key={c.crewUuid} value={c.crewUuid}>{crewName(c)} — {crewRank(c) || "Rank not set"}</SelectItem>)}</SelectContent></Select>
      <Select value={vesselUuid} onValueChange={setVesselUuid}><SelectTrigger><SelectValue placeholder="Choose vessel" /></SelectTrigger><SelectContent>{vessels.map((v: any) => <SelectItem key={v.vesselUuid || v.uuid} value={v.vesselUuid || v.uuid}>{v.vessel || v.name}</SelectItem>)}</SelectContent></Select>
      <div className="space-y-1"><Select value={formUuid} onValueChange={setFormUuid}><SelectTrigger><SelectValue placeholder="Choose briefing form" /></SelectTrigger><SelectContent>{briefingForms.map((f: any) => <SelectItem key={f.formUuid || f.form_uuid} value={f.formUuid || f.form_uuid}>{f.formName || f.name || f.formUuid}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">The selected crew member's current rank determines the rank group and released form version.</p></div>
      <Button disabled={!crewUuid || !formUuid || create.isPending || resolutionQuery.isFetching || !resolutionQuery.data} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create submission"}</Button>
    </div>
    {crewUuid && formUuid && (
      <div className="text-sm">
        {resolutionQuery.isFetching && <p className="text-muted-foreground">Resolving rank group and released version…</p>}
        {resolutionQuery.error && <p className="text-destructive">{resolutionQuery.error instanceof Error ? resolutionQuery.error.message : String(resolutionQuery.error)}</p>}
        {resolutionQuery.data && (
          <p className="text-emerald-700" data-testid="briefing-resolution">
            Resolved for rank {resolutionQuery.data.rank}: {resolutionQuery.data.rankGroupName} · version ID {resolutionQuery.data.formVersionId} · {resolutionQuery.data.formVersionUuid}
          </p>
        )}
      </div>
    )}
    {crewUuid && <div className="flex flex-wrap gap-2">{listQuery.isLoading ? "Loading submissions…" : listQuery.data?.map((s: any) => <Button key={s.briefing_submission_uuid} size="sm" variant="outline" onClick={() => setSubmissionUuid(s.briefing_submission_uuid)}>Open {s.status} · {s.created_at ? new Date(s.created_at).toLocaleDateString() : s.briefing_submission_uuid.slice(0, 8)}</Button>)}</div>}
    {model && <><p className={`text-sm ${saveState === "error" ? "text-destructive" : ""}`}>{saveState === "saving" ? "Saving draft…" : saveState === "error" ? "Draft save failed; retry with Save draft." : "Draft saved"}</p><ConfiguredFormRenderer mode="live" embedded parts={[{ formPartUuid: "briefing", partCode: "B", partTitle: "Briefing", partType: "configurable" }]} selectedPartUuid="briefing" structures={{ briefing: model.sections }} selectedVesselTypeUuid={model.submission.vessel_type_uuid || "all"} live={{ answers: draftAnswers, answerComments: draftComments, sectionComments: draftSectionComments, onSectionCommentChange: (section, comment) => { draftSectionCommentsRef.current = { ...draftSectionCommentsRef.current, [section]: comment }; setDraftSectionComments(draftSectionCommentsRef.current); queueSectionComment(section, comment); }, sectionStates: model.states, sectionOwnership: model.ownership, onSaveDraft: flush, onAnswerChange: (q, value) => { draftAnswersRef.current = { ...draftAnswersRef.current, [q]: value }; setDraftAnswers(draftAnswersRef.current); queueQuestion(q, value, draftCommentsRef.current[q] ?? null); }, onAnswerCommentChange: (q, comment) => { draftCommentsRef.current = { ...draftCommentsRef.current, [q]: comment }; setDraftComments(draftCommentsRef.current); queueQuestion(q, draftAnswersRef.current[q] ?? null, comment); }, onSignatureChange: async (section, data, name) => { await flush(); await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${section}/signature`, { data, name }); await queryClient.invalidateQueries({ queryKey: [BASE, submissionUuid] }); }, onSubmitSection: async (section, comment) => { await flush(); await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${section}/submit`, { comment: comment || null }); await queryClient.invalidateQueries({ queryKey: [BASE, submissionUuid] }); } }} /></>}
  </div>;
}