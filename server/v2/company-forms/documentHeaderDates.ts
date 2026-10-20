import type { FrozenDocumentInput } from "../../../shared/v2/forms-engine/documentEvidence";

/** Presentation uses only signing-time evidence; a planned date is not sign-on. */
export function documentHeaderFields(input: FrozenDocumentInput) {
  return input.header.subject.fields.filter(field => {
    if (["Crew ID", "Nationality"].includes(field.label)) return false;
    if (field.label === "Planned joining date")
      return input.source.stageKey === "before_joining" && !!field.value;
    if (field.label === "Sign-on date")
      return ["on_board", "at_sign_off"].includes(input.source.stageKey ?? "") && !!field.value;
    return true;
  });
}
