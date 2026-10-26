import React, { useId, useLayoutEffect, useRef } from 'react';
import { FormattedDateInput, parseManualDate } from '@/components/ui/formatted-date-input';

type Props = Omit<
  Extract<React.ComponentProps<typeof FormattedDateInput>, { mode?: 'date' }>,
  'ref'
>;

// Used only by the reported Recruitment and Crew Pool date fields.
export function RuleAwareDateInput({ onDraftChange, ...props }: Props) {
  const controlRef = useRef<HTMLDivElement>(null);
  const ruleErrorId = useId();

  const syncErrorPresentation = () => {
    const control = controlRef.current;
    const input = control?.querySelector<HTMLInputElement>('input[type="text"]');
    if (!control || !input) return;

    const sibling = control.nextElementSibling;
    const formatError = sibling instanceof HTMLParagraphElement &&
      sibling.getAttribute('role') === 'alert' ? sibling : null;
    const realDate = parseManualDate(input.value) !== null;
    if (formatError) formatError.hidden = realDate;

    const next = control.parentElement?.nextElementSibling;
    const ruleError = next instanceof HTMLParagraphElement ? next : null;
    let description: string | null = null;
    if (formatError && !realDate) {
      description = formatError.id;
    } else if (ruleError) {
      if (!ruleError.id) ruleError.id = ruleErrorId;
      description = ruleError.id;
    }
    if (input.getAttribute('aria-describedby') !== description) {
      if (description) input.setAttribute('aria-describedby', description);
      else input.removeAttribute('aria-describedby');
    }
  };

  useLayoutEffect(() => {
    const field = controlRef.current?.parentElement?.parentElement;
    if (!field) return;
    const observer = new MutationObserver(syncErrorPresentation);
    observer.observe(field, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-describedby'],
    });
    syncErrorPresentation();
    return () => observer.disconnect();
  });

  return (
    <FormattedDateInput
      {...props}
      ref={controlRef}
      onDraftChange={(draft) => {
        syncErrorPresentation();
        onDraftChange?.(draft);
      }}
    />
  );
}
