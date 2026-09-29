import {
  forwardRef,
  useCallback,
  useId,
  type AriaAttributes,
  type ComponentPropsWithoutRef,
  type MutableRefObject,
} from 'react';
import {
  FormattedDateInput,
} from '@/components/ui/formatted-date-input';

type DaDateInputProps =
  ComponentPropsWithoutRef<typeof FormattedDateInput> & {
    name: string;
    id?: string;
    label: string;
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
        'aria-invalid': ariaInvalid,
        'aria-describedby': ariaDescribedBy,
        ...dateProps
      },
      forwardedRef,
    ) {
      const labelId = useId();
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
          role="group"
          aria-label={label}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          data-da-date-field={name}
          className="w-full min-w-0"
          onChangeCapture={(event) => {
            if (event.target instanceof HTMLInputElement) {
              event.currentTarget.dataset.daDateEdited = 'true';
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