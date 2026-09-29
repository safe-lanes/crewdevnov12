/** Display-only hierarchy. Arrays are already in their user-visible order; an
 * explicit sortOrder takes precedence when supplied by an API consumer. */
export function companyFormNumbers<
  P extends { formPartUuid: string; sortOrder?: number; isDeleted?: boolean; isHidden?: boolean },
  S extends { section_uuid?: string; clientKey?: string; sortOrder?: number; is_deleted?: boolean; isDeleted?: boolean; isHidden?: boolean; questions: Q[] },
  Q extends { question_uuid?: string; clientKey?: string; response_type?: string; sortOrder?: number; is_deleted?: boolean; isDeleted?: boolean; isHidden?: boolean },
>(
  parts: P[],
  structures: Record<string, S[]>,
) {
  const part = new Map<string, string>();
  const section = new Map<string, string>();
  const question = new Map<string, string>();
  const active = <T extends { sortOrder?: number; is_deleted?: boolean; isDeleted?: boolean; isHidden?: boolean }>(items: T[]) =>
    items.filter((item) => !item.is_deleted && !item.isDeleted && !item.isHidden)
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (a.item.sortOrder ?? a.index) - (b.item.sortOrder ?? b.index) || a.index - b.index)
      .map(({ item }) => item);
  active(parts).forEach((p, pi) => {
    const pn = String(pi + 1);
    part.set(p.formPartUuid, pn);
    active(structures[p.formPartUuid] || []).forEach((s, si) => {
      const sn = `${pn}.${si + 1}`;
      const sid = s.section_uuid || s.clientKey;
      if (sid) section.set(sid, sn);
      active(s.questions).filter((q) => q.response_type !== "content").forEach((q, qi) => {
        const qid = q.question_uuid || q.clientKey;
        if (qid) question.set(qid, `${sn}.${qi + 1}`);
      });
    });
  });
  return { part, section, question };
}