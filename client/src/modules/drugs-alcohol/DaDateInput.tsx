import {
  forwardRef,
  useCallback,
  useId,
  useEffect,
  useLayoutEffect,
  useRef,
  type AriaAttributes,
  type ComponentPropsWithoutRef,
  type MutableRefObject,
} from 'react';
import {
  FormattedDateInput,
  parseManualDate,
} from '@/components/ui/formatted-date-input';

type DaDateInputProps =
  ComponentPropsWithoutRef<typeof FormattedDateInput> & {
    name: string;
    id?: string;
    label: string;
    beforeMinMessage?: string;
    'aria-invalid'?: AriaAttributes['aria-invalid'];
    'aria-describedby'?: string;
  };

export const DaDateInput =
  forwardRef<HTMLInputElement, DaDateInputProps>(
    function DaDateInput(
      {
        name,
        id,
        label,
        beforeMinMessage,
        'aria-invalid': ariaInvalid,
        'aria-describedby': ariaDescribedBy,
        ...dateProps
      },
      forwardedRef,
    ) {
      const labelId = useId();
      const groupRef = useRef<HTMLDivElement>(null);
      const attemptedDraft = useRef<string | null>(null);
      const originalMessages = useRef(new WeakMap<HTMLElement, string>());
      const syncMessage = useCallback(() => {
        const group = groupRef.current;
        const input = group?.querySelector<HTMLInputElement>('input[type="text"]');
        const error = group?.querySelector<HTMLElement>('[role="alert"]');
        if (!input || !error || !beforeMinMessage ||
            (dateProps.mode && dateProps.mode !== 'date')) return;
        if (!originalMessages.current.has(error)) {
          originalMessages.current.set(error, error.textContent ?? '');
        }
        const canonical = parseManualDate(attemptedDraft.current ?? input.value);
        const message = canonical && dateProps.min && canonical < dateProps.min
          ? beforeMinMessage
          : originalMessages.current.get(error)!;
        if (error.textContent !== message) error.textContent = message;
      }, [beforeMinMessage, dateProps.min, dateProps.mode]);
      useEffect(() => {
        attemptedDraft.current = null;
      }, [dateProps.value]);
      useLayoutEffect(() => {
        const group = groupRef.current;
        if (!group) return;

        if (!beforeMinMessage ||
            (dateProps.mode && dateProps.mode !== 'date')) {
          const error = group.querySelector<HTMLElement>('[role="alert"]');
          const original = error && originalMessages.current.get(error);
          if (error && original !== undefined && error.textContent !== original) {
            error.textContent = original;
          }
          return;
        }

        const observer = new MutationObserver(syncMessage);
        observer.observe(group, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['value'],
        });
        syncMessage();

        return () => {
          observer.disconnect();
        };
      }, [beforeMinMessage, dateProps.mode, syncMessage]);

      const connectInput = useCallback(
        (control: HTMLDivElement | null) => {
          const input =
            control?.querySelector<HTMLInputElement>(
              'input[type="text"]',
            ) ?? null;
          if (control && !input) {
            throw new Error(
              'D&A date input: shared text input was not found.',
            );
          }
          if (input) {
            // These attributes are not supplied by the current
            // shared component. Keep this bridge D&A-local.
            input.name = name;
            input.setAttribute('aria-labelledby', labelId);
            if (id) {
              input.id = id;
            } else {
              input.removeAttribute('id');
            }
          }
          if (typeof forwardedRef === 'function') {
            forwardedRef(input);
          } else if (forwardedRef) {
            (
              forwardedRef as
                MutableRefObject<HTMLInputElement | null>
            ).current = input;
          }
        },
        [forwardedRef, id, name, labelId],
      );
      return (
        <div
          ref={groupRef}
          role="group"
          aria-label={label}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          data-da-date-field={name}
          className="w-full min-w-0"
          onChangeCapture={(event) => {
            if (event.target instanceof HTMLInputElement) {
              event.currentTarget.dataset.daDateEdited = 'true';
              if (beforeMinMessage && event.target.type === 'text') {
                attemptedDraft.current = event.target.value;
              }
            }
          }}
        >
          <span id={labelId} className="sr-only">
            {label}
          </span>
          <FormattedDateInput
            {...dateProps}
            ref={connectInput}
          />
        </div>
      );
    },
  );