import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { format, parse, isValid } from 'date-fns';
import {
  useGridCellEditor,
  type CustomCellEditorProps,
} from 'ag-grid-react';
import {
  FormattedDateInput,
  formatIsoDate,
  parseManualDate,
} from '@/components/ui/formatted-date-input';
import { useToast } from '@/hooks/use-toast';

const toInputValue = (stored?: string): string => {
  if (!stored) return '';
  const d = parse(stored, 'dd-MMM-yyyy', new Date());
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
};

const toStoredValue = (input: string): string => {
  if (!input) return '';
  const d = parse(input, 'yyyy-MM-dd', new Date());
  return isValid(d) ? format(d, 'dd-MMM-yyyy') : '';
};

export const PlannedDateCellEditor = (
  props: CustomCellEditorProps<any, string>,
) => {
  const { toast } = useToast();
  const [value, setValue] = useState(
    () => toInputValue(props.value ?? ''),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(formatIsoDate(value));
  const finishedRef = useRef(false);
  const notifiedRef = useRef(false);
  const getTextInput = useCallback(
    () =>
      rootRef.current?.querySelector<HTMLInputElement>(
        'input[type="text"]',
      ) ?? null,
    [],
  );
  const focusText = useCallback(() => {
    getTextInput()?.focus({ preventScroll: true });
  }, [getTextInput]);
  const isDraftValid = useCallback(() => {
    const draft =
      getTextInput()?.value ?? draftRef.current;
    return (
      draft.trim() === '' ||
      parseManualDate(draft) !== null
    );
  }, [getTextInput]);
  const notifyInvalidExit = useCallback(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    toast({
      title: 'Date change not saved',
      description:
        'The date was incomplete or invalid. The original value has been kept.',
      variant: 'destructive',
    });
  }, [toast]);
  const finishEditing = useCallback(
    (cancel = false) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      props.api.stopEditing(cancel);
    },
    [props.api],
  );
  const leaveEditor = useCallback(() => {
    if (finishedRef.current) return;
    if (!isDraftValid()) {
      notifyInvalidExit();
      finishEditing(true);
      return;
    }
    finishEditing();
  }, [
    finishEditing,
    isDraftValid,
    notifyInvalidExit,
  ]);
  useGridCellEditor({
    focusIn: focusText,
    isCancelAfterEnd: () => {
      const invalid = !isDraftValid();
      // Covers grid-driven exits as well as local exits.
      // Explicit Escape cancellation does not need a warning.
      if (invalid && !finishedRef.current) {
        notifyInvalidExit();
      }
      return invalid;
    },
  });
  useEffect(() => {
    const ownerDocument = rootRef.current?.ownerDocument;
    if (!ownerDocument) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const target = event.target;
      if (
        finishedRef.current ||
        !root ||
        !(target instanceof Node) ||
        root.contains(target)
      ) {
        return;
      }
      // Never block the user's outside action.
      leaveEditor();
    };
    ownerDocument.addEventListener(
      'pointerdown',
      handlePointerDown,
      true,
    );
    focusText();
    return () => {
      ownerDocument.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true,
      );
    };
  }, [focusText, leaveEditor]);
  return (
    <div
      ref={rootRef}
      className="flex h-full w-full min-w-0 items-center"
      onKeyDownCapture={(event) => {
        const textInput = getTextInput();
        const calendarButton =
          rootRef.current?.querySelector<HTMLButtonElement>(
            'button[aria-label="Choose date from calendar"]',
          );
        // Do not interpret native date-picker keys
        // as grid-editing commands.
        if (
          event.target instanceof HTMLInputElement &&
          event.target.type === 'date'
        ) {
          event.stopPropagation();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finishEditing(true);
          return;
        }
        if (event.key === 'Tab') {
          if (
            event.target === textInput &&
            !event.shiftKey &&
            calendarButton
          ) {
            event.preventDefault();
            event.stopPropagation();
            calendarButton.focus();
            return;
          }
          if (
            event.target === calendarButton &&
            event.shiftKey
          ) {
            event.preventDefault();
            event.stopPropagation();
            focusText();
            return;
          }
          // At the editor boundary, preserve grid navigation.
          // isCancelAfterEnd rejects an invalid draft.
          return;
        }
        if (
          event.target === calendarButton &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          // Preserve the button's default activation.
          event.stopPropagation();
          return;
        }
        if (
          event.target === textInput &&
          event.key === 'Enter'
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (isDraftValid()) {
            finishEditing();
          } else {
            toast({
              title: 'Invalid date',
              description:
                'Correct the date, clear it, or press Esc to cancel.',
              variant: 'destructive',
            });
          }
          return;
        }
        if (
          event.target === textInput &&
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
          ].includes(event.key)
        ) {
          event.stopPropagation();
        }
      }}
    >
      <FormattedDateInput
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          props.onValueChange(toStoredValue(next));
        }}
        onDraftChange={(draft) => {
          draftRef.current = draft;
        }}
        retainInvalidDraftOnBlur
        className="w-full h-8 text-xs"
        data-testid="input-planned-date"
      />
    </div>
  );
};
