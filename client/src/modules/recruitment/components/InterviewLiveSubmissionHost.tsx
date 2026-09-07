import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfiguredFormRenderer, type ConfiguredFormAnswerValue, type ConfiguredFormPart, type ConfiguredFormSection, type ConfiguredSignatureType } from "@/components/configured-form/ConfiguredFormRenderer";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/hooks/use-toast";
import { interviewFixedParts } from "./InterviewFixedParts";

const BASE = "/api/v2/interviews";
const getJson = async (url: string) => { const response = await fetch(url, { credentials: "include" }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`); return body; };
const ownershipFor = (section: any, actor: any) => {
  const admin = actor.roleName?.trim().toLowerCase() === "admin";
  if (section.responsible_mode === "role") return { ownerLabel: section.responsible_role_name?.trim() || "Responsible role no longer exists", canEdit: admin || section.responsible_role_uuid === actor.roleId };
  if (admin) return { ownerLabel: "Administrator", canEdit: true };
  if (section.responsible_mode === "not_applicable") return { ownerLabel: "Any authenticated user", canEdit: true };
  return { ownerLabel: section.responsible_department ? `Department: ${section.responsible_department} (identity unavailable)` : "Department owner not configured", canEdit: false };
};
export const groupInterviewSectionsByPart = (parts: any[], sections: ConfiguredFormSection[]) => Object.fromEntries(parts.map(part => [part.form_part_uuid, sections.filter(section => (section as any).form_part_uuid === part.form_part_uuid)]));
const layout = (section: any, questions: any[]) => {
  const optionSets = new Set(questions.map(question => question.option_set_uuid || section.default_option_set_uuid || ""));
  const options = questions[0]?.options || [];
  const matrix = questions.length > 0 && questions.every(question => ["single_select", "multi_select"].includes(question.response_type)) && optionSets.size === 1 && options.length > 0 && options.length <= 12 && (options.length <= 6 || options.every((option: any) => option.option_label.trim().length <= 4));
  return section.layout_preference === "list" || !matrix ? "list" : "matrix";
};
export async function openOrCreateInterview(interviewItemUuid: string, existingSubmissionUuid?: string) {
  if (existingSubmissionUuid) return existingSubmissionUuid;
  const response = await apiRequest("POST", `${BASE}/submissions`, { interviewItemUuid });
  const created: any = await response.json();
  return created.interview_submission_uuid;
}

export default function InterviewLiveSubmissionHost({ submissionUuid, onBack }: { submissionUuid: string; onBack: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast(); const { roleName, roleId, userType } = usePermissions();
  const read = useQuery<any>({ queryKey: [BASE, submissionUuid], queryFn: () => getJson(`${BASE}/submissions/${submissionUuid}`) });
  const [answers, setAnswers] = useState<Record<string, ConfiguredFormAnswerValue>>({}); const [comments, setComments] = useState<Record<string, string | null>>({}); const [sectionComments, setSectionComments] = useState<Record<string, string>>({});
  const pending = useRef(new Map<string, any>()); const timer = useRef<number>(); const flushActive = useRef<Promise<void> | null>(null); const hydrated = useRef(false);
  const answersRef = useRef(answers); const commentsRef = useRef(comments); const sectionCommentsRef = useRef(sectionComments); answersRef.current = answers; commentsRef.current = comments; sectionCommentsRef.current = sectionComments;
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (!read.data || hydrated.current) return; const a: any = {}, c: any = {}; (read.data.answers || []).forEach((item: any) => { try { a[item.question_uuid] = JSON.parse(item.answer_value); } catch { a[item.question_uuid] = item.answer_value; } c[item.question_uuid] = item.answer_comment; }); hydrated.current = true; setAnswers(a); setComments(c); setSectionComments(Object.fromEntries((read.data.section_states || []).map((item: any) => [item.section_uuid, item.section_comment || ""]))); }, [read.data]);
  const model = useMemo(() => {
    const data = read.data; if (!data) return null; const options = new Map<string, any[]>();
    (data.structure.options || []).forEach((option: any) => options.set(option.option_set_uuid, [...(options.get(option.option_set_uuid) || []), option]));
    const sections: ConfiguredFormSection[] = (data.structure.sections || []).map((section: any) => { const questions = (data.structure.questions || []).filter((question: any) => question.section_uuid === section.section_uuid).map((question: any) => ({ ...question, options: options.get(question.option_set_uuid || section.default_option_set_uuid) || [] })); return { ...section, questions, applicable_vessel_types: Array.isArray(section.applicable_vessel_types) ? section.applicable_vessel_types : [], effectiveLayout: layout(section, questions) } as ConfiguredFormSection; });
    const parts: ConfiguredFormPart[] = (data.parts || []).map((part: any) => ({ formPartUuid: part.form_part_uuid, partCode: part.part_code, partTitle: part.part_title, partType: part.part_type, isOfficeOnly: part.is_office_only }));
    const signatures = new Map<string, any[]>(); (data.signatures || []).forEach((item: any) => signatures.set(item.section_state_uuid, [...(signatures.get(item.section_state_uuid) || []), item]));
    const states = Object.fromEntries((data.section_states || []).map((state: any) => [state.section_uuid, { status: state.status, sectionComment: state.section_comment, submittedByName: state.submitted_by_name, submittedAt: state.submitted_at, signatures: Object.fromEntries((signatures.get(state.section_state_uuid) || []).map((item: any) => [item.signature_type, { signatureAttUuid: item.sig_att_uuid, signatureName: item.signer_name, signatureRank: item.signer_rank, witnessedByName: item.witnessed_by_name, signedAt: item.signed_at, signatureUrl: item.sig_att_uuid ? `${BASE}/signatures/${item.sig_att_uuid}/raw` : null }])) }]));
    return { data, parts, structures: groupInterviewSectionsByPart(data.parts || [], sections), sections, states, ownership: Object.fromEntries(sections.map(section => [section.section_uuid, ownershipFor(section, { roleName, roleId, userType })])) };
  }, [read.data, roleName, roleId, userType]);
  const flush = async () => { if (!flushActive.current) flushActive.current = (async () => { while (pending.current.size) { const batch = [...pending.current.entries()]; pending.current.clear(); try { for (const [section, item] of batch) await apiRequest("PUT", `${BASE}/submissions/${submissionUuid}/sections/${section}/answers`, { answers: Object.entries(item.answers).map(([questionUuid, value]: any) => ({ questionUuid, value: value.value, comment: value.comment })), sectionComment: item.sectionComment }); } catch (error) { for (const [section, older] of batch) { const newer = pending.current.get(section); pending.current.set(section, newer ? { answers: { ...older.answers, ...newer.answers }, sectionComment: newer.sectionComment ?? older.sectionComment } : older); } throw error; } } await qc.invalidateQueries({ queryKey: [BASE, submissionUuid] }); })().finally(() => { flushActive.current = null; }); await flushActive.current; };
  const queue = (question: string, value: ConfiguredFormAnswerValue, comment: string | null) => { const section = read.data?.structure.questions.find((item: any) => item.question_uuid === question)?.section_uuid; if (!section) return; const item = pending.current.get(section) || { answers: {}, sectionComment: sectionCommentsRef.current[section] || null }; item.answers[question] = { value, comment }; pending.current.set(section, item); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void flush(), 600); };
  if (read.isLoading) return <div className="min-h-[100dvh] p-8 text-sm text-muted-foreground">Loading interview record…</div>;
  if (read.error || !model) return <div className="min-h-[100dvh] p-8 text-sm text-destructive">{read.error instanceof Error ? read.error.message : "Interview unavailable"}<Button className="ml-3" variant="outline" onClick={onBack}>Back to recruitment</Button></div>;
  const completed = String(model.data.submission?.status || "").toLowerCase() === "completed"; const refresh = () => void qc.invalidateQueries({ queryKey: [BASE, submissionUuid] });
  return <ConfiguredFormRenderer mode="live" formTitle="Crew Interview" parts={model.parts} structures={model.structures} selectedVesselTypeUuid="all" onBack={onBack} fixedParts={interviewFixedParts(submissionUuid, model.data, completed, refresh)} live={{ answers, answerComments: comments, sectionComments, sectionStates: model.states, sectionOwnership: model.ownership, onSectionCommentChange: (section, value) => { setSectionComments(v => ({ ...v, [section]: value })); const item = pending.current.get(section) || { answers: {}, sectionComment: null }; item.sectionComment = value; pending.current.set(section, item); }, onAnswerChange: (question, value) => { setAnswers(v => ({ ...v, [question]: value })); queue(question, value, commentsRef.current[question] ?? null); }, onAnswerCommentChange: (question, value) => { setComments(v => ({ ...v, [question]: value })); queue(question, answersRef.current[question] ?? "", value); }, onSaveDraft: flush, onSubmitSection: async (section, comment) => { await flush(); await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${section}/submit`, { comment: comment || null }); refresh(); }, onSignatureChange: async (section, type: ConfiguredSignatureType, data, signerName, signerRank) => { await flush(); try { await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${section}/signature`, { type, data, ...(signerName ? { signerName } : {}), ...(signerRank ? { signerRank } : {}) }); refresh(); toast({ title: "Signature saved", description: "The signature and signing date have been recorded." }); } catch (error) { toast({ title: "Signature save failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" }); throw error; } }, onDeleteSignature: async (section, type) => { await flush(); await apiRequest("DELETE", `${BASE}/submissions/${submissionUuid}/sections/${section}/signature/${type}`); refresh(); } }} />;
}