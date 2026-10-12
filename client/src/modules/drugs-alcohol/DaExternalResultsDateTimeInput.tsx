import {
  forwardRef,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type SyntheticEvent,
  type ComponentPropsWithoutRef,
} from 'react';
import { CalendarDays } from 'lucide-react';
import {
  formatIsoDate,
  formatIsoDateTime,
  parseManualDateTime,
} from '@/components/ui/formatted-date-input';
const EXTERNAL_RESULTS_EARLY_MESSAGE =
  'Date External Test Results received date cannot be before Date & Time Test completed';
const FORMAT_MESSAGE = 'Incorrect date/date format';
function externalResultsDateTimeKey(value: string): string | null {
  if (!value || formatIsoDateTime(value) === value) return null;
  const [whole, fraction = ''] = value.split('.');
  return (whole.length === 16 ? whole + ':00' : whole) +
    '.' + (fraction.replace(/0+$/, '') || '0');
}
function display(value: string): string {
  return formatIsoDate(value) || formatIsoDateTime(value);
}
type Props = Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'value' | 'onChange' | 'onBlur' | 'min' | 'max' | 'step'
> & {
  name: string;
  label: string;
  value: string;
  min?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  'data-testid'?: string;
};
export const DaExternalResultsDateTimeInput =
  forwardRef<HTMLInputElement, Props>(
    function DaExternalResultsDateTimeInput(
      {
        value,
        min,
        label,
        onChange,
        onBlur,
        disabled,
        readOnly,
        className,
        'data-testid': testId,
        ...inputProps
      },
      ref,
    ) {
      const [draft, setDraft] = useState(() => display(value));
      const [edited, setEdited] = useState(false);
      const [warning, setWarning] = useState<string | null>(null);
      const [pickerInvalid, setPickerInvalid] = useState(false);
      const ownValue = useRef<string | undefined>(undefined);
      const textRef = useRef<HTMLInputElement | null>(null);
      const pickerRef = useRef<HTMLInputElement | null>(null);
      const errorId = useId();
      const labelId = useId();
      const previousMin = useRef(min);
      const previousValue = useRef(value);
      const externalValueChange =
        value !== previousValue.current &&
        value !== ownValue.current;
      const minimum = min ? externalResultsDateTimeKey(min) : null;
      const minimumDate = min && formatIsoDate(min) ? min : null;
      // Calendar boundary only: allow the whole known date, without
      // assigning a completion time or changing any stored value.
      const pickerMinimum = minimum
        ? min!.slice(0, 16)
        : minimumDate ? minimumDate + 'T00:00' : undefined;
      const resolve = (text: string): string | null => {
        if (!text.trim()) return '';
        if (
          text === display(value) &&
          externalResultsDateTimeKey(value)
        ) {
          return value;
        }
        return parseManualDateTime(text);
      };
      const reason = (next: string | null): string | null => {
        if (next === null) return FORMAT_MESSAGE;
        if (next && !externalResultsDateTimeKey(next)) {
          return FORMAT_MESSAGE;
        }
        const key = next ? externalResultsDateTimeKey(next) : null;
        const beforeMinimum = key && (
          minimum ? key < minimum :
          minimumDate ? next.slice(0, 10) < minimumDate : false
        );
        return beforeMinimum
          ? EXTERNAL_RESULTS_EARLY_MESSAGE
          : null;
      };
      const canonical = edited ? resolve(draft) : value;
      const invalid =
        edited && (pickerInvalid || reason(canonical) !== null);
      useLayoutEffect(() => {
        if (value !== ownValue.current) {
          setDraft(display(value));
          setEdited(false);
          setWarning(null);
          setPickerInvalid(false);
        }
        previousValue.current = value;
        ownValue.current = undefined;
        if (pickerRef.current) {
          pickerRef.current.value =
            externalResultsDateTimeKey(value)
              ? value.slice(0, 16)
              : '';
        }
      }, [value]);
      useLayoutEffect(() => {
        if (previousMin.current === min) return;
        previousMin.current = min;
        if (externalValueChange) return;
        if (canonical && externalResultsDateTimeKey(canonical)) {
          setEdited(true);
          setWarning(reason(canonical));
        }
      }, [min]);
      const emit = (next: string, event: SyntheticEvent) => {
        ownValue.current = next;
        const input = textRef.current!;
        const previous = input.value;
        input.value = next;
        const forwarded = Object.assign(Object.create(event), {
          target: input,
          currentTarget: input,
        });
        try {
          onChange(forwarded);
        } finally {
          input.value = previous;
        }
      };
      const blocked = (input: HTMLElement) =>
        disabled || readOnly || input.matches(':disabled');
      const pickerEdit = (
        event: ChangeEvent<HTMLInputElement>,
        commit: boolean,
      ) => {
        const input = event.currentTarget;
        if (blocked(input)) return;
        setEdited(true);
        if (
          input.validity.badInput ||
          input.validity.stepMismatch ||
          input.validity.rangeOverflow
        ) {
          setPickerInvalid(true);
          setWarning(FORMAT_MESSAGE);
          return;
        }
        const selected = input.value;
        const next =
          selected &&
          externalResultsDateTimeKey(value) &&
          selected.slice(11) === value.slice(11, 16)
            ? selected + value.slice(16)
            : selected;
        setDraft(display(next));
        setPickerInvalid(false);
        const error = reason(next);
        setWarning(error);
        if (commit && !error) emit(next, event);
      };
      const blur = (event: FocusEvent<HTMLInputElement>) => {
        if (edited) {
          const next = resolve(draft);
          const error = pickerInvalid ? FORMAT_MESSAGE : reason(next);
          setWarning(error);
          if (error === EXTERNAL_RESULTS_EARLY_MESSAGE) {
            setDraft(display(value));
            if (pickerRef.current) {
              pickerRef.current.value =
                externalResultsDateTimeKey(value)
                  ? value.slice(0, 16)
                  : '';
            }
          } else if (!error && next !== null) {
            setDraft(display(next));
          }
        }
        const input = textRef.current!;
        const previous = input.value;
        input.value = value;
        try {
          onBlur?.(Object.assign(Object.create(event), {
            target: input,
            currentTarget: input,
          }));
        } finally {
          input.value = previous;
        }
      };
      return (
        <div
          role="group"
          aria-label={label}
          className="w-full min-w-0"
          data-datetime-field={inputProps.name}
          data-datetime-edited={edited ? 'true' : undefined}
          data-datetime-invalid={invalid ? 'true' : undefined}
          data-datetime-canonical={canonical ?? undefined}
        >
          <style>{
            '.da-external-results-picker::-webkit-calendar-picker-indicator {' +
            'position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:pointer;}'
          }</style>
          <span id={labelId} className="sr-only">
            {label}
          </span>
          <div
            className={[
              'relative flex h-9 w-full items-center rounded-md border bg-transparent text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring',
              disabled ? 'cursor-not-allowed opacity-60' : '',
              warning ? 'border-red-500' : '',
              className,
            ].filter(Boolean).join(' ')}
          >
            <input
              {...inputProps}
              type="text"
              value={draft}
              ref={input => {
                textRef.current = input;
                if (typeof ref === 'function') {
                  ref(input);
                } else if (ref) {
                  ref.current = input;
                }
              }}
              disabled={disabled}
              readOnly={readOnly}
              placeholder="DD-MMM-YYYY or DD-MM-YYYY --:-- --"
              inputMode="text"
              autoComplete="off"
              aria-labelledby={labelId}
              aria-invalid={
                Boolean(warning) || inputProps['aria-invalid']
              }
              aria-describedby={[
                inputProps['aria-describedby'],
                warning ? errorId : undefined,
              ].filter(Boolean).join(' ') || undefined}
              data-testid={testId}
              className="h-full min-w-0 flex-1 bg-transparent px-3 py-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              onChange={event => {
                if (blocked(event.currentTarget)) return;
                const text = event.currentTarget.value;
                setDraft(text);
                setEdited(true);
                setPickerInvalid(false);
                const next = resolve(text);
                const error = reason(next);
                setWarning(previous => previous ? error : null);
                if (!error && next !== null) {
                  if (pickerRef.current) {
                    pickerRef.current.value =
                      next ? next.slice(0, 16) : '';
                  }
                  emit(next, event);
                }
              }}
              onBlur={event => {
                if (event.relatedTarget === pickerRef.current) return;
                blur(event);
              }}
            />
            <div className="relative flex h-full w-9 flex-shrink-0 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted focus-within:ring-1 focus-within:ring-ring">
              <CalendarDays
                className="pointer-events-none h-3.5 w-3.5"
                aria-hidden="true"
              />
              <input
                ref={pickerRef}
                type="datetime-local"
                step={60}
                min={pickerMinimum ?? '0001-01-01T00:00'}
                max="9999-12-31T23:59"
                disabled={disabled || readOnly}
                aria-label="Choose date and time from calendar"
                data-testid={testId ? testId + '-picker' : undefined}
                className="da-external-results-picker absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                onInputCapture={event => {
                  event.stopPropagation();
                  pickerEdit(
                    event as ChangeEvent<HTMLInputElement>,
                    false,
                  );
                }}
                onChange={event => pickerEdit(event, true)}
                onBlur={blur}
              />
            </div>
          </div>
          {pickerInvalid && (
            <button
              type="button"
              disabled={disabled || readOnly}
              className="mt-1 text-xs underline"
              aria-label="Clear external test results date and time"
              onClick={event => {
                if (blocked(event.currentTarget)) return;
                setDraft('');
                setEdited(true);
                setPickerInvalid(false);
                setWarning(null);
                if (pickerRef.current) {
                  pickerRef.current.value = '';
                }
                emit('', event);
              }}
            >
              Clear
            </button>
          )}
          {warning && (
            <p
              id={errorId}
              role="alert"
              className="mt-1 text-xs leading-4 text-red-500"
            >
              {warning}
            </p>
          )}
        </div>
      );
    },
  );
