import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfiguredFormRenderer, type ConfiguredFormAnswerValue, type ConfiguredFormPart, type ConfiguredFormSection, type ConfiguredSignatureType } from "@/components/configured-form/ConfiguredFormRenderer";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/hooks/use-toast";
import { debriefingFixedParts } from "./DebriefingFixedParts";

const BASE = "/api/v2/debriefings";
const getJson = async (url: string) => { const response = await fetch(url); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`); return body; };
export const groupDebriefingSectionsByPart = (parts: any[], sections: ConfiguredFormSection[]) => Object.fromEntries(parts.map(part => [part.form_part_uuid, sections.filter(section => (section as any).form_part_uuid === part.form_part_uuid)]));
export const isPersistedDebriefingUuid = (value?: string): boolean => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
export const reconcileSavedDebriefingUuid = <T extends { id: string; debriefingUuid?: string }>(
  rows: T[],
  localId: string,
  created: { debriefingUuid?: string; debriefing_uuid?: string },
) => {
  const debriefingUuid = created.debriefingUuid || created.debriefing_uuid;
  return debriefingUuid ? rows.map(row => row.id === localId ? { ...row, debriefingUuid } : row) : rows;
};
export const debriefingCreationErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || "");
  const json = message.match(/(\{.*\})/);
  if (json) {
    try {
      const body = JSON.parse(json[1]);
      if (typeof body?.error === "string") return body.error;
    } catch { /* retain the response text below */ }
  }
  return message.replace(/^\d{3}:\s*/, "").trim() || "Please try again.";
};
export async function openOrCreateDebriefing(debriefingUuid: string, existingSubmissionUuid?: string) {
  if (existingSubmissionUuid) return existingSubmissionUuid;
  const response = await apiRequest("POST", `${BASE}/submissions`, { debriefingUuid });
  const created: any = await response.json();
  return created.debriefing_submission_uuid;
}
export const debriefingLayout = (section: any, questions: any[]): "list" | "matrix" => {
  const optionSetIds = new Set(questions.map(question => question.option_set_uuid || section.default_option_set_uuid || ""));
  const options = questions[0]?.options || [];
  const eligible = questions.length > 0
    && questions.every(question => ["single_select", "multi_select"].includes(question.response_type))
    && optionSetIds.size === 1
    && Boolean(optionSetIds.values().next().value)
    && options.length > 0
    && options.length <= 12
    && (options.length <= 6 || options.every((option: any) => String(option.option_label || "").trim().length <= 4));
  return section.layout_preference === "list" || !eligible ? "list" : "matrix";
};
export const attachDebriefingQuestionOptions = (question: any, section: any, optionsBySet: Map<string, any[]>) =>
  optionsBySet.get(question.option_set_uuid || section.default_option_set_uuid) || [];
export const mergeDebriefingPendingItem = (older: any, newer?: any) => {
  if (!newer) return older;
  return {
    ...older,
    ...newer,
    answers: { ...(older?.answers || {}), ...(newer.answers || {}) },
    sectionComment: Object.prototype.hasOwnProperty.call(newer, "sectionComment")
      ? newer.sectionComment
      : older?.sectionComment,
  };
};

export default function DebriefingLiveSubmissionHost({ submissionUuid, onBack }: { submissionUuid: string; onBack: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast(); const { roleName, roleId, userType } = usePermissions();
  const read = useQuery<any>({ queryKey: [BASE, submissionUuid], queryFn: () => getJson(`${BASE}/submissions/${submissionUuid}`) });
  const [answers, setAnswers] = useState<Record<string, ConfiguredFormAnswerValue>>({}); const [comments, setComments] = useState<Record<string, string | null>>({}); const [sectionComments, setSectionComments] = useState<Record<string, string>>({});
  const pending = useRef(new Map<string, any>()); const timer = useRef<number>(); const flushActive = useRef<Promise<void> | null>(null); const hydrated = useRef(false);
  const answersRef = useRef(answers), commentsRef = useRef(comments), sectionCommentsRef = useRef(sectionComments); answersRef.current = answers; commentsRef.current = comments; sectionCommentsRef.current = sectionComments;
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (!read.data || hydrated.current) return; const nextAnswers: any = {}; const nextComments: any = {}; (read.data.answers || []).forEach((item: any) => { try { nextAnswers[item.question_uuid] = JSON.parse(item.answer_value); } catch { nextAnswers[item.question_uuid] = item.answer_value; } nextComments[item.question_uuid] = item.answer_comment; }); hydrated.current = true; setAnswers(nextAnswers); setComments(nextComments); setSectionComments(Object.fromEntries((read.data.section_states || []).map((item: any) => [item.section_uuid, item.section_comment || ""]))); }, [read.data]);
  const model = useMemo(() => { const data = read.data; if (!data) return null; const options = new Map<string, any[]>(); (data.structure.options || []).forEach((option: any) => options.set(option.option_set_uuid, [...(options.get(option.option_set_uuid) || []), option])); const sections: ConfiguredFormSection[] = (data.structure.sections || []).map((section: any) => { const questions = (data.structure.questions || []).filter((question: any) => question.section_uuid === section.section_uuid).map((question: any) => ({ ...question, options: attachDebriefingQuestionOptions(question, section, options) })); return { ...section, applicable_vessel_types: typeof section.applicable_vessel_types === "string" ? JSON.parse(section.applicable_vessel_types || "[]") : section.applicable_vessel_types || [], effectiveLayout: debriefingLayout(section, questions), questions }; }); const parts: ConfiguredFormPart[] = (data.parts || []).filter((part: any) => !part.is_office_only || userType?.toLowerCase() === "office").map((part: any) => ({ formPartUuid: part.form_part_uuid, partCode: part.part_code, partTitle: part.part_title, partType: part.part_type, isOfficeOnly: part.is_office_only })); const structures = groupDebriefingSectionsByPart(data.parts || [], sections); const signatures = new Map<string, any[]>(); (data.signatures || []).forEach((item: any) => signatures.set(item.section_state_uuid, [...(signatures.get(item.section_state_uuid) || []), item])); const states = Object.fromEntries((data.section_states || []).map((state: any) => [state.section_uuid, { status: state.status, sectionComment: state.section_comment, submittedByName: state.submitted_by_name, submittedAt: state.submitted_at, signatures: Object.fromEntries((signatures.get(state.section_state_uuid) || []).map((sig: any) => [sig.signature_type, { signatureAttUuid: sig.sig_att_uuid, signatureName: sig.signer_name, signatureRank: sig.signer_rank, witnessedByName: sig.witnessed_by_name, signedAt: sig.signed_at, signatureUrl: sig.sig_att_uuid ? `${BASE}/signatures/${sig.sig_att_uuid}/raw` : null }])) }])); const ownership = Object.fromEntries(sections.map(section => [section.section_uuid!, section.responsible_mode === "role" ? { ownerLabel: section.responsible_role_name || "Responsible role", canEdit: roleName?.toLowerCase() === "admin" || section.responsible_role_uuid === roleId } : { ownerLabel: section.responsible_department ? `Department: ${section.responsible_department}` : "Any authenticated user", canEdit: roleName?.toLowerCase() === "admin" || section.responsible_mode === "not_applicable" }])); return { data, parts, sections, structures, states, ownership }; }, [read.data, roleName, roleId, userType]);
  const flush = async () => { if (!flushActive.current) flushActive.current = (async () => { while (pending.current.size) { const batch = [...pending.current.entries()]; pending.current.clear(); try { for (const [section, item] of batch) await apiRequest("PUT", `${BASE}/submissions/${submissionUuid}/sections/${section}/answers`, { answers: Object.entries(item.answers).map(([questionUuid, value]: any) => ({ questionUuid, value: value.value, comment: value.comment })), sectionComment: item.sectionComment }); } catch (error) { for (const [section, older] of batch) pending.current.set(section, mergeDebriefingPendingItem(older, pending.current.get(section))); throw error; } } await qc.invalidateQueries({ queryKey: [BASE, submissionUuid] }); })().finally(() => { flushActive.current = null; }); await flushActive.current; };
  const queue = (question: string, value: ConfiguredFormAnswerValue, comment: string | null) => { const section = read.data?.structure.questions.find((item: any) => item.question_uuid === question)?.section_uuid; if (!section) return; const item = pending.current.get(section) || { answers: {}, sectionComment: sectionCommentsRef.current[section] || null }; item.answers[question] = { value, comment }; pending.current.set(section, item); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void flush().catch(() => undefined), 600); };
  if (read.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading debriefing…</div>;
  if (read.error || !model) return <div className="p-8 text-sm text-destructive">{read.error instanceof Error ? read.error.message : "Debriefing unavailable"}</div>;
  const completed = ["complete", "completed"].includes(String(model.data.submission?.status || "").toLowerCase()); const refresh = () => void qc.invalidateQueries({ queryKey: [BASE, submissionUuid] });
  return <ConfiguredFormRenderer mode="live" formTitle="Debriefing" parts={model.parts} structures={model.structures} selectedVesselTypeUuid={model.data.submission?.vessel_type_uuid || "all"} onBack={onBack} fixedParts={debriefingFixedParts(submissionUuid, { partA: model.data.partA, partC: model.data.partC }, completed, refresh)} live={{ answers, answerComments: comments, sectionComments, sectionStates: model.states, sectionOwnership: model.ownership, signatureDefaults: { seafarer: { name: model.data.seafarer_default?.signer_name, rank: model.data.seafarer_default?.signer_rank }, officer: { name: model.data.officer_default?.signer_name, rank: model.data.officer_default?.signer_rank } }, onAnswerChange: (question, value) => { setAnswers(next => ({ ...next, [question]: value })); queue(question, value, commentsRef.current[question] ?? null); }, onAnswerCommentChange: (question, comment) => { setComments(next => ({ ...next, [question]: comment })); queue(question, answersRef.current[question] ?? "", comment); }, onSectionCommentChange: (section, comment) => { setSectionComments(next => ({ ...next, [section]: comment })); const item = pending.current.get(section) || { answers: {}, sectionComment: null }; item.sectionComment = comment; pending.current.set(section, item); }, onSaveDraft: flush, onSubmitSection: async (section, comment) => { await flush(); await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${section}/submit`, { comment: comment || null }); refresh(); }, onDeleteSignature: async (section, type) => { await flush(); await apiRequest("DELETE", `${BASE}/submissions/${submissionUuid}/sections/${section}/signature/${type}`); refresh(); }, onSignatureChange: async (section, type: ConfiguredSignatureType, data, signerName, signerRank) => { await flush(); await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${section}/signature`, { type, data, ...(signerName ? { signerName } : {}), ...(signerRank ? { signerRank } : {}) }); toast({ title: "Signature saved", description: "The signature and signing date have been recorded." }); refresh(); } }} />;
}