import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfiguredFormRenderer, type ConfiguredFormAnswerValue, type ConfiguredFormPart, type ConfiguredFormSection, type ConfiguredSignatureType } from "@/components/configured-form/ConfiguredFormRenderer";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useToast } from "@/hooks/use-toast";
import { BriefingPartA, BriefingPartC } from "./BriefingFixedParts";

const BASE = "/api/v2/briefings";
const getJson = async (url: string) => { const r = await fetch(url); const b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.error || `Request failed (${r.status})`); return b; };
const ownershipFor = (s: any, actor: any) => {
  const admin = actor.roleName?.trim().toLowerCase() === "admin";
  if (s.responsible_mode === "role") return { ownerLabel: s.responsible_role_name?.trim() || "Responsible role no longer exists", canEdit: admin || s.responsible_role_uuid === actor.roleId };
  if (admin) return { ownerLabel: "Administrator", canEdit: true };
  if (s.responsible_mode === "not_applicable") return { ownerLabel: "Any authenticated user", canEdit: true };
  return { ownerLabel: s.responsible_department ? `Department: ${s.responsible_department} (identity unavailable)` : "Department owner not configured", canEdit: false };
};
const layout = (s: any, qs: any[]) => {
  const ids = new Set(qs.map(q => q.option_set_uuid || s.default_option_set_uuid || ""));
  const options = qs[0]?.options || [];
  const eligible = qs.length > 0 && qs.every(q => ["single_select", "multi_select"].includes(q.response_type)) && ids.size === 1 && !!ids.values().next().value && options.length > 0 && options.length <= 12 && (options.length <= 6 || options.every((o: any) => o.option_label.trim().length <= 4));
  return s.layout_preference === "list" || !eligible ? "list" : "matrix";
};
export default function BriefingLiveSubmissionHost({ submissionUuid, onBack }: { submissionUuid: string; onBack: () => void }) {
  const qc = useQueryClient(); const { toast } = useToast(); const { roleName, roleId, userType } = usePermissions();
  const read = useQuery<any>({ queryKey: [BASE, submissionUuid], queryFn: () => getJson(`${BASE}/submissions/${submissionUuid}`) });
  const [answers, setAnswers] = useState<Record<string, ConfiguredFormAnswerValue>>({});
  const [comments, setComments] = useState<Record<string, string | null>>({});
  const [sectionComments, setSectionComments] = useState<Record<string, string>>({});
  const pending = useRef(new Map<string, any>()); const timer = useRef<number>();
  const flushActive = useRef<Promise<void> | null>(null);
  const hydrated = useRef(false);
  const answersRef = useRef(answers), commentsRef = useRef(comments), sectionCommentsRef = useRef(sectionComments);
  answersRef.current = answers; commentsRef.current = comments; sectionCommentsRef.current = sectionComments;
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!read.data || hydrated.current) return;
    const a: any = {}, c: any = {};
    (read.data.answers || []).forEach((x: any) => {
      try { a[x.question_uuid] = JSON.parse(x.answer_value); } catch { a[x.question_uuid] = x.answer_value; }
      c[x.question_uuid] = x.answer_comment;
    });
    hydrated.current = true;
    setAnswers(a);
    setComments(c);
    setSectionComments(Object.fromEntries((read.data.section_states || []).map((x: any) => [x.section_uuid, x.section_comment || ""])));
  }, [read.data]);
  const model = useMemo(() => { const d = read.data; if (!d) return null; const opts = new Map<string, any[]>(); (d.structure.options || []).forEach((o: any) => opts.set(o.option_set_uuid, [...(opts.get(o.option_set_uuid) || []), o])); const sections: ConfiguredFormSection[] = (d.structure.sections || []).map((s: any) => { const qs = (d.structure.questions || []).filter((q: any) => q.section_uuid === s.section_uuid).map((q: any) => ({ ...q, options: opts.get(q.option_set_uuid) || [] })); return { ...s, questions: qs, applicable_vessel_types: typeof s.applicable_vessel_types === "string" ? JSON.parse(s.applicable_vessel_types || "[]") : (s.applicable_vessel_types || []), effectiveLayout: layout(s, qs) }; }); const signatures = new Map<string, any[]>(); (d.signatures || []).forEach((x: any) => signatures.set(x.section_state_uuid, [...(signatures.get(x.section_state_uuid) || []), x])); const states = Object.fromEntries((d.section_states || []).map((s: any) => { const sig = Object.fromEntries((signatures.get(s.section_state_uuid) || []).map((x: any) => [x.signature_type, { signatureAttUuid: x.sig_att_uuid, signatureName: x.signer_name, signatureRank: x.signer_rank, witnessedByName: x.witnessed_by_name, signedAt: x.signed_at, signatureUrl: x.sig_att_uuid ? `${BASE}/signatures/${x.sig_att_uuid}/raw` : null }])); return [s.section_uuid, { status: s.status, sectionComment: s.section_comment, submittedByName: s.submitted_by_name, submittedAt: s.submitted_at, signatures: sig }]; })); return { sections, states, ownership: Object.fromEntries(sections.map(s => [s.section_uuid!, ownershipFor(s, { roleName, roleId, userType })])), submission: d.submission, signatureDefaults: { seafarer: { name: d.seafarer_default?.signer_name, rank: d.seafarer_default?.signer_rank }, officer: { name: d.officer_default?.signer_name, rank: d.officer_default?.signer_rank } } }; }, [read.data, roleName, roleId, userType]);
  const flush = async () => {
    if (!flushActive.current) {
      flushActive.current = (async () => {
        while (pending.current.size) {
          const batch = [...pending.current.entries()];
          pending.current.clear();
          try {
            for (const [section, item] of batch) {
              await apiRequest("PUT", `${BASE}/submissions/${submissionUuid}/sections/${section}/answers`, {
                answers: Object.entries(item.answers).map(([questionUuid, x]: any) => ({ questionUuid, value: x.value, comment: x.comment })),
                sectionComment: item.sectionComment,
              });
            }
          } catch (error) {
            for (const [section, older] of batch) {
              const newer = pending.current.get(section);
              pending.current.set(section, newer ? {
                answers: { ...older.answers, ...newer.answers },
                sectionComment: newer.sectionComment ?? older.sectionComment,
              } : older);
            }
            throw error;
          }
        }
        await qc.invalidateQueries({ queryKey: [BASE, submissionUuid] });
      })().finally(() => { flushActive.current = null; });
    }
    await flushActive.current;
  };
  const queue = (q: string, value: ConfiguredFormAnswerValue, comment: string | null) => { const section = read.data?.structure.questions.find((x: any) => x.question_uuid === q)?.section_uuid; if (!section) return; const item = pending.current.get(section) || { answers: {}, sectionComment: sectionCommentsRef.current[section] || null }; item.answers[q] = { value, comment }; pending.current.set(section, item); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void flush(), 600); };
  if (read.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading briefing…</div>;
  if (read.error || !model) return <div className="p-8 text-sm text-destructive">{read.error instanceof Error ? read.error.message : "Briefing unavailable"}</div>;
  const parts: ConfiguredFormPart[] = [
    { formPartUuid: "part-a", partCode: "A", partTitle: "Seafarer's information", partType: "fixed" },
    { formPartUuid: "part-b", partCode: "B", partTitle: "Briefing", partType: "configurable" },
    ...(userType?.toLowerCase() === "office"
      ? [{ formPartUuid: "part-c", partCode: "C", partTitle: "Office review", partType: "fixed" as const }]
      : []),
  ];
  const completed = ["complete", "completed"].includes(String(model.submission?.status || "").toLowerCase());
  const refresh = () => { void qc.invalidateQueries({ queryKey: [BASE, submissionUuid] }); };
  return <ConfiguredFormRenderer mode="live" formTitle="Briefing" parts={parts} structures={{ "part-b": model.sections }} selectedVesselTypeUuid={model.submission?.vessel_type_uuid || "all"} onBack={onBack} fixedParts={{ partA: <BriefingPartA submissionUuid={submissionUuid} data={read.data.partA} completed={completed} onSaved={refresh} />, partC: <BriefingPartC submissionUuid={submissionUuid} data={read.data.partC} completed={completed} onSaved={refresh} /> }} live={{ answers, answerComments: comments, sectionComments, sectionStates: model.states, sectionOwnership: model.ownership, signatureDefaults: model.signatureDefaults, onDeleteSignature: async (s, t) => { await flush(); await apiRequest("DELETE", `${BASE}/submissions/${submissionUuid}/sections/${s}/signature/${t}`); refresh(); }, onSectionCommentChange: (s, c) => { setSectionComments(v => ({ ...v, [s]: c })); const i = pending.current.get(s) || { answers: {}, sectionComment: null }; i.sectionComment = c; pending.current.set(s, i); }, onAnswerChange: (q, v) => { setAnswers(a => ({ ...a, [q]: v })); queue(q, v, commentsRef.current[q] ?? null); }, onAnswerCommentChange: (q, c) => { setComments(a => ({ ...a, [q]: c })); queue(q, answersRef.current[q] ?? "", c); }, onSaveDraft: flush, onSubmitSection: async (s, c) => { await flush(); await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${s}/submit`, { comment: c || null }); refresh(); }, onSignatureChange: async (s, t: ConfiguredSignatureType, data, signerName, signerRank) => { await flush(); try { await apiRequest("POST", `${BASE}/submissions/${submissionUuid}/sections/${s}/signature`, { type: t, data, ...(signerName ? { signerName } : {}), ...(signerRank ? { signerRank } : {}) }); refresh(); toast({ title: "Signature saved", description: "The signature and signing date have been recorded." }); } catch (e) { toast({ title: "Signature save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); throw e; } } }} />;
}