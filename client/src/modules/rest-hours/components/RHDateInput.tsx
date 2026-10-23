import * as React from 'react';
import { format } from 'date-fns';
import { FormattedDateInput, formatIsoDate, parseManualDate } from '@/components/ui/formatted-date-input';
import { useToast } from '@/hooks/use-toast';

export type RHDateInputHandle = { validate: () => boolean };
type Value = string | Date | undefined;
type Props = {
  validationRef?: React.Ref<RHDateInputHandle>;
  resetKey?: unknown;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'data-testid'?: string;
} & (
  | { kind: 'calendar'; value: Date | undefined; onChange: (value: Date | undefined) => void }
  | { kind: 'native'; value: string; onChange: (value: string) => void }
);

function canonical(value: Value): string {
  return typeof value === 'string' ? value : value ? format(value, 'yyyy-MM-dd') : '';
}

function displaySaved(value: string): string {
  if (!value || formatIsoDate(value)) return formatIsoDate(value);
  const match = /^(\d{5,})-(\d{2})-(\d{2})$/.exec(value);
  const input = document.createElement('input');
  input.type = 'date';
  input.value = value;
  return match && input.value === value
    ? `${match[3]}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(match[2]) - 1]}-${match[1]}`
    : '';
}

function calendarValue(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isUnavailableDay(value: string): boolean {
  const date = calendarValue(value);
  return !!date && canonical(date) !== value;
}

export const RHDateInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const { toast } = useToast();
  const value = canonical(props.value);
  const root = React.useRef<HTMLDivElement>(null);
  const draft = React.useRef(displaySaved(value));
  const edited = React.useRef(false);
  const unavailableDraft = React.useRef<string | null>(null);
  const outgoing = React.useRef<{ value: Value } | null>(null);
  const lastResetKey = React.useRef(props.resetKey);
  const latestValue = React.useRef(value);
  latestValue.current = value;
  const latestSource = React.useRef({ value: props.value, resetKey: props.resetKey });
  latestSource.current = { value: props.value, resetKey: props.resetKey };
  const [generation, setGeneration] = React.useState(0);
  const restoreFocus = React.useRef<{
    input: HTMLInputElement;
    start: number | null;
    end: number | null;
    direction: 'forward' | 'backward' | 'none' | null;
  } | null>(null);

  React.useLayoutEffect(() => {
    const ownChange = outgoing.current && Object.is(outgoing.current.value, props.value);
    outgoing.current = null;
    const sameReset = Object.is(lastResetKey.current, props.resetKey);
    lastResetKey.current = props.resetKey;
    if (ownChange && sameReset) return;
    const text = root.current?.querySelector<HTMLInputElement>('input[type="text"]');
    restoreFocus.current = text && document.activeElement === text
      ? { input: text, start: text.selectionStart, end: text.selectionEnd, direction: text.selectionDirection }
      : null;
    edited.current = false;
    unavailableDraft.current = null;
    draft.current = displaySaved(value);
    setGeneration(n => n + 1);
  }, [props.value, props.resetKey]);

  React.useImperativeHandle(ref, () => root.current!.querySelector<HTMLInputElement>('input[type="text"]')!, [generation]);
  React.useImperativeHandle(props.validationRef, () => ({
    validate: () => {
      const parsed = parseManualDate(draft.current);
      if (!edited.current || !draft.current.trim() ||
        (parsed && (props.kind === 'native' || !isUnavailableDay(parsed)))) return true;
      toast({ title: 'Validation Error', description: 'Correct or clear the invalid date before saving.', variant: 'destructive' });
      root.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      return false;
    },
  }));

  React.useLayoutEffect(() => {
    const text = root.current?.querySelector<HTMLInputElement>('input[type="text"]');
    const native = root.current?.querySelector<HTMLInputElement>('input[type="date"]');
    const button = root.current?.querySelector<HTMLButtonElement>('button');
    if (!text || !native || !button) throw new Error('Shared date selector markup changed; update the RH adapter.');
    for (const [name, attribute] of Object.entries({ id: props.id, name: props.name, 'aria-label': props['aria-label'] ?? (props.id ? undefined : 'Date') })) {
      if (attribute === undefined) text.removeAttribute(name);
      else text.setAttribute(name, attribute);
    }
    const syncAccessibility = () => {
      const warning = root.current?.querySelector<HTMLElement>('[role="alert"]');
      const outerInvalid = props['aria-invalid'];
      const invalid = String(outerInvalid && outerInvalid !== 'false' ? outerInvalid : !!warning);
      const describedBy = [...new Set([...(props['aria-describedby'] ?? '').split(/\s+/), warning?.id].filter(Boolean))].join(' ');
      if (text.getAttribute('aria-invalid') !== invalid) text.setAttribute('aria-invalid', invalid);
      if (describedBy) {
        if (text.getAttribute('aria-describedby') !== describedBy) text.setAttribute('aria-describedby', describedBy);
      } else if (text.hasAttribute('aria-describedby')) text.removeAttribute('aria-describedby');
    };
    syncAccessibility();
    native.value = value;
    native.min = '0001-01-01';
    native.max = value && !formatIsoDate(value) ? '' : '9999-12-31';
    native.tabIndex = props.disabled ? -1 : 0;
    native.setAttribute('aria-label', 'Choose date from calendar');
    Object.assign(native.style, { pointerEvents: 'auto', width: '2.25rem', height: '100%', right: '0', top: '0', cursor: props.disabled ? 'not-allowed' : 'pointer' });
    button.tabIndex = -1;
    button.setAttribute('aria-hidden', 'true');
    const pending = restoreFocus.current;
    if (pending && pending.input !== text) {
      restoreFocus.current = null;
      if (document.activeElement === document.body && !text.matches(':disabled')) {
        text.focus({ preventScroll: true });
        if (pending.start !== null && pending.end !== null) text.setSelectionRange(pending.start, pending.end, pending.direction ?? 'none');
      }
    }
    const observer = new MutationObserver(syncAccessibility);
    observer.observe(root.current!, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid', 'aria-describedby', 'id', 'role'] });
    return () => observer.disconnect();
  });

  const locked = (input: HTMLInputElement) => props.disabled || input.matches(':disabled') || !!input.closest('fieldset[disabled]');
  const syncCalendar = (input: HTMLInputElement) => queueMicrotask(() => {
    if (input.isConnected && root.current?.contains(input)) input.value = latestValue.current;
  });
  return (
    <div
      ref={root}
      data-rh-shared-date=""
      style={{ display: 'contents' }}
      onPointerDownCapture={event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'date') return;
        if (locked(input)) { event.preventDefault(); return; }
        root.current?.querySelector('button')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }}
      onChangeCapture={event => {
        const input = event.target as HTMLInputElement;
        if (locked(input)) {
          event.stopPropagation();
          input.value = input.type === 'text' ? draft.current : latestValue.current;
          if (input.type === 'date') syncCalendar(input);
          return;
        }
        if (input.type === 'date' && (!input.validity.valid || (input.value !== '' && (!formatIsoDate(input.value) || (props.kind === 'calendar' && isUnavailableDay(input.value)))))) {
          event.stopPropagation();
          input.value = latestValue.current;
          syncCalendar(input);
          return;
        }
        edited.current = true;
        if (input.type === 'text') {
          draft.current = input.value;
          const parsed = parseManualDate(input.value);
          unavailableDraft.current = props.kind === 'calendar' && parsed && isUnavailableDay(parsed)
            ? input.value : null;
        }
      }}
      onBlurCapture={event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        if (input.type === 'date') {
          syncCalendar(input);
          if (!locked(input) && input.validity.valid) {
            const pending = input.value;
            if (pending !== latestValue.current && !(pending === '' && latestValue.current && !formatIsoDate(latestValue.current)) && (pending === '' || formatIsoDate(pending))) {
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
        const pendingDraft = unavailableDraft.current;
        const pendingValue = props.value;
        const pendingReset = props.resetKey;
        if (pendingDraft !== null) queueMicrotask(() => {
          if (!root.current?.isConnected || unavailableDraft.current !== pendingDraft ||
            !Object.is(latestSource.current.value, pendingValue) ||
            !Object.is(latestSource.current.resetKey, pendingReset)) return;
          const active = document.activeElement;
          if (active instanceof HTMLInputElement && active.type === 'date' && root.current.contains(active)) return;
          const text = root.current.querySelector<HTMLInputElement>('input[type="text"]');
          if (text && active === text) {
            restoreFocus.current = { input: text, start: text.selectionStart, end: text.selectionEnd, direction: text.selectionDirection };
          }
          setGeneration(n => n + 1);
        });
        props.onBlur?.();
      }}
    >
      <style>{`
        [data-rh-shared-date] input[type="date"]::-webkit-calendar-picker-indicator {
          position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer;
        }
      `}</style>
      <FormattedDateInput
        key={generation}
        mode="date"
        value={value}
        initialDraft={unavailableDraft.current ?? displaySaved(value)}
        acceptCalendarInputEvents
        retainInvalidDraftOnBlur
        disabled={props.disabled}
        className={props.className}
        data-testid={props['data-testid']}
        onDraftChange={next => { draft.current = unavailableDraft.current ?? next; }}
        onChange={event => {
          if (locked(event.target)) return;
          edited.current = true;
          const next = event.target.value;
          if (props.kind === 'calendar' && next && isUnavailableDay(next)) return;
          unavailableDraft.current = null;
          if (props.kind === 'calendar') {
            const date = next === value ? props.value : calendarValue(next);
            outgoing.current = { value: date };
            props.onChange(date);
          } else {
            outgoing.current = { value: next };
            props.onChange(next);
          }
        }}
      />
    </div>
  );
});
RHDateInput.displayName = 'RHDateInput';
