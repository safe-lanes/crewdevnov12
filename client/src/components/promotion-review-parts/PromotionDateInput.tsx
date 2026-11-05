import { createContext, useContext, type ChangeEventHandler } from 'react';
import { Input } from '@/components/ui/input';
import {
  FormattedDateInput,
  formatIsoDate,
  parseManualDate,
} from '@/components/ui/formatted-date-input';

export const PromotionCalendarInputEventsContext = createContext(false);

type Draft = {
  value: string;
  text: string;
  legacy: boolean;
};
export type PromotionDateDrafts = Map<string, Draft>;

interface Props {
  drafts: PromotionDateDrafts;
  fieldKey: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  'data-testid'?: string;
}

export function PromotionDateInput({
  drafts,
  fieldKey,
  ...props
}: Props) {
  const acceptCalendarInputEvents = useContext(
    PromotionCalendarInputEventsContext
  );
  let draft = drafts.get(fieldKey);
  if (!draft || draft.value !== props.value) {
    draft = {
      value: props.value,
      text: formatIsoDate(props.value),
      legacy: Boolean(
        draft?.legacy ||
        (props.value && !formatIsoDate(props.value))
      ),
    };
    drafts.set(fieldKey, draft);
  }
  // Existing unsupported values retain their original native editing behavior.
  if (draft.legacy) {
    return <Input {...props} type="date" />;
  }
  const entry = draft;
  const fixedWidth = fieldKey.startsWith('ces:')
    ? 'min-w-32 max-w-32 [&_input[type=text]]:px-1 [&_button]:w-7'
    : 'min-w-40 max-w-40';
  return (
    <FormattedDateInput
      value={props.value}
      onChange={props.onChange}
      disabled={props.disabled}
      acceptCalendarInputEvents={acceptCalendarInputEvents}
      className={`text-base md:text-sm ${props.className || ''} ${fixedWidth}`}
      data-testid={props['data-testid']}
      initialDraft={entry.text}
      onDraftChange={(text) => {
        entry.text = text;
      }}
    />
  );
}

// Refuses a save while a date field holds text that is not a valid date. The
// rows are the CES tests and approvers this save includes.
export function assertPromotionDateDrafts(
  data: {
    cesTests?: { id: string; date?: string | null }[];
    approvers?: { id: string; date?: string | null }[];
    promotionDate?: string | null;
  },
  drafts: PromotionDateDrafts
) {
  const check = (
    key: string,
    value: string | null | undefined,
    label: string
  ) => {
    const draft = drafts.get(key);
    if (
      draft &&
      !draft.legacy &&
      draft.value === (value || '') &&
      draft.text.trim() &&
      !parseManualDate(draft.text)
    ) {
      throw new Error(
        `Enter a valid ${label}, or clear the field.`
      );
    }
  };
  for (const row of data.cesTests ?? []) {
    check(`ces:${row.id}`, row.date, 'A2.7 test date');
  }
  for (const row of data.approvers ?? []) {
    check(`approver:${row.id}`, row.date, 'B1 approver date');
  }
  if (data.promotionDate !== undefined) {
    check('promotion', data.promotionDate, 'C1.1 promotion date');
  }
}