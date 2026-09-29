import * as React from "react";
import {
  FormattedDateInput,
  formatIsoDate,
  parseManualDate,
} from "../ui/formatted-date-input";
type Props = {
  value: string | null | undefined;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  min?: string;
  rejectBeforeMin?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  tabIndex?: number;
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "data-testid"?: string;
};
function nativeDate(value: string) {
  const input = document.createElement("input");
  input.type = "date";
  input.value = value;
  return !!value && input.value === value;
}
function beforeNativeMin(input: HTMLInputElement) {
  return (
    !!input.value &&
    nativeDate(input.min) &&
    Number(input.value.replace(/-/g, "")) <
      Number(input.min.replace(/-/g, ""))
  );
}
// Display support for existing saved dates only.
// New manual entries are parsed by the shared selector's parser.
function displaySaved(value: string) {
  const ordinary = formatIsoDate(value);
  if (ordinary || !value) return ordinary;
  const match = /^(\d{5,})-(\d{2})-(\d{2})$/.exec(value);
  const native = document.createElement("input");
  native.type = "date";
  native.value = value;
  return match && native.value === value
    ? `${match[3]}-${
        [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ][Number(match[2]) - 1]
      }-${match[1]}`
    : "";
}
export const AppraisalDateInput = React.forwardRef<HTMLInputElement, Props>(
  (props, ref) => {
    const value = props.value ?? "";
    const root = React.useRef<HTMLDivElement>(null);
    const [accepted, setAccepted] = React.useState(value);
    const [generation, setGeneration] = React.useState(0);
    const [draft, setDraft] = React.useState(() => displaySaved(value));
    const [, refresh] = React.useReducer(n => n + 1, 0);
    const outgoing = React.useRef<string | undefined>(undefined);
    const rejected = React.useRef(false);
    // A: Preserve text focus and selection across an external draft reset.
    const restoreFocus = React.useRef<{
      input: HTMLInputElement;
      start: number | null;
      end: number | null;
      direction: "forward" | "backward" | "none" | null;
    } | null>(null);
    const latestValue = React.useRef(value);
    latestValue.current = value;
    React.useLayoutEffect(() => {
      if (outgoing.current === value) {
        outgoing.current = undefined;
        return;
      }
      const text =
        root.current?.querySelector<HTMLInputElement>('input[type="text"]');
      restoreFocus.current =
        text && document.activeElement === text
          ? {
              input: text,
              start: text.selectionStart,
              end: text.selectionEnd,
              direction: text.selectionDirection,
            }
          : null;
      setAccepted(value);
      setGeneration(n => n + 1);
    }, [value]);
    React.useImperativeHandle(
      ref,
      () =>
        root.current!.querySelector<HTMLInputElement>('input[type="text"]')!,
      [generation],
    );
    React.useLayoutEffect(() => {
      const text =
        root.current?.querySelector<HTMLInputElement>('input[type="text"]');
      const native =
        root.current?.querySelector<HTMLInputElement>('input[type="date"]');
      const button =
        root.current?.querySelector<HTMLButtonElement>("button");
      if (!text || !native || !button) {
        throw new Error(
          "Shared date selector markup changed; update the Appraisal adapter.",
        );
      }
      text.readOnly = !!props.readOnly;
      text.tabIndex = props.tabIndex ?? 0;
      for (const [name, val] of Object.entries({
        id: props.id,
        name: props.name,
        "aria-label": props["aria-label"] ?? (props.id ? undefined : "Date"),
      })) {
        if (val === undefined) {
          text.removeAttribute(name);
        } else {
          text.setAttribute(name, val);
        }
      }
      // B: Preserve both the form's help/error connections and shared warning.
      const syncAccessibility = () => {
        const error =
          root.current?.querySelector<HTMLElement>('[role="alert"]');
        const invalid = String(props["aria-invalid"] || !!error);
        const describedBy = [
          ...new Set(
            [
              ...(props["aria-describedby"] ?? "").split(/\s+/),
              error?.id,
            ].filter(Boolean),
          ),
        ].join(" ");
        if (text.getAttribute("aria-invalid") !== invalid) {
          text.setAttribute("aria-invalid", invalid);
        }
        if (describedBy) {
          if (text.getAttribute("aria-describedby") !== describedBy) {
            text.setAttribute("aria-describedby", describedBy);
          }
        } else if (text.hasAttribute("aria-describedby")) {
          text.removeAttribute("aria-describedby");
        }
      };
      syncAccessibility();
      // Adapt the shared native input; do not create a separate picker.
      native.value = value;
      native.min = props.min || "0001-01-01";
      // An untouched legacy date's warning must not add a native submit blocker.
      native.max =
        nativeDate(value) && !formatIsoDate(value) ? "" : "9999-12-31";
      native.disabled = !!(props.disabled || props.readOnly);
      native.tabIndex = props.readOnly ? -1 : 0;
      native.setAttribute("aria-label", "Choose date from calendar");
      Object.assign(native.style, {
        pointerEvents: "auto",
        width: "2.25rem",
        height: "100%",
        right: "0",
        top: "0",
        cursor: props.readOnly ? "not-allowed" : "pointer",
      });
      button.disabled = !!(props.disabled || props.readOnly);
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
      // A: Restore focus only after the old text input has been replaced.
      const pending = restoreFocus.current;
      if (pending && pending.input !== text) {
        restoreFocus.current = null;
        if (
          document.activeElement === document.body &&
          !text.matches(":disabled")
        ) {
          text.focus({ preventScroll: true });
          if (pending.start !== null && pending.end !== null) {
            text.setSelectionRange(
              pending.start,
              pending.end,
              pending.direction ?? "none",
            );
          }
        }
      }
      // B: Also handle updates made internally by the shared selector.
      const observer = new MutationObserver(syncAccessibility);
      observer.observe(root.current!, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [
          "aria-invalid",
          "aria-describedby",
          "id",
          "role",
        ],
      });
      return () => observer.disconnect();
    });
    // C: Reconcile after React completes its controlled-input event handling.
    // This does not emit a change or modify the form value.
    const scheduleCalendarSync = (input: HTMLInputElement) => {
      queueMicrotask(() => {
        if (input.isConnected && root.current?.contains(input)) {
          input.value = latestValue.current;
        }
      });
    };
    const locked = (input: HTMLInputElement) =>
      props.readOnly ||
      props.disabled ||
      input.matches(":disabled") ||
      !!input.closest("fieldset[disabled]");
    const send = (
      event: React.ChangeEvent<HTMLInputElement>,
      next: string,
    ) => {
      const input = event.target;
      const previous = input.value;
      input.value = next;
      outgoing.current = next;
      const forwarded = Object.assign(Object.create(event), {
        target: input,
        currentTarget: input,
      });
      try {
        props.onChange(forwarded);
      } finally {
        input.value = previous;
      }
    };
    return (
      <div
        ref={root}
        data-appraisal-shared-date=""
        style={{ display: "contents" }}
        onPointerDownCapture={event => {
          const input = event.target;
          if (
            !(input instanceof HTMLInputElement) ||
            input.type !== "date"
          ) {
            return;
          }
          if (locked(input)) {
            event.preventDefault();
            return;
          }
          root.current?.querySelector("button")?.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true }),
          );
        }}
        onChangeCapture={event => {
          const input = event.target as HTMLInputElement;
          if (locked(input)) {
            event.stopPropagation();
            input.value =
              input.type === "text" ? draft : latestValue.current;
            if (input.type === "date") {
              scheduleCalendarSync(input);
            }
            return;
          }
          if (input.type !== "text") {
            if (
              !input.validity.valid ||
              beforeNativeMin(input) ||
              (input.value !== "" && !formatIsoDate(input.value))
            ) {
              event.stopPropagation();
              input.value = latestValue.current;
              scheduleCalendarSync(input);
            }
            return;
          }
          const next = parseManualDate(input.value);
          if (
            next &&
            props.rejectBeforeMin &&
            props.min &&
            next < props.min
          ) {
            if (value && !formatIsoDate(value)) {
              event.stopPropagation();
              input.value = draft;
              return;
            }
            rejected.current = true;
            input.value = formatIsoDate(value);
          } else if (input.value.trim() && !next) {
            send(event as React.ChangeEvent<HTMLInputElement>, "");
          }
        }}
        onBlurCapture={event => {
          const input = event.target;
          if (
            !(input instanceof HTMLInputElement) ||
            input.type !== "date"
          ) {
            return;
          }
          scheduleCalendarSync(input);
          if (
            locked(input) ||
            !input.validity.valid ||
            beforeNativeMin(input)
          ) {
            return;
          }
          const pending = input.value;
          if (
            pending === value ||
            (pending === "" && value !== "" && !formatIsoDate(value))
          ) {
            return;
          }
          if (pending !== "" && !formatIsoDate(pending)) return;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }}
      >
        <style>{`
          [data-appraisal-shared-date] input[type="date"]::-webkit-calendar-picker-indicator {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            opacity: 0;
            cursor: pointer;
          }
        `}</style>
        <FormattedDateInput
          key={generation}
          mode="date"
          value={accepted}
          initialDraft={displaySaved(accepted)}
          acceptCalendarInputEvents
          className={props.className}
          disabled={props.disabled}
          data-testid={props["data-testid"]}
          onDraftChange={setDraft}
          onChange={event => {
            if (locked(event.target)) return;
            const next = event.target.value;
            setAccepted(next);
            if (rejected.current) {
              rejected.current = false;
              return;
            }
            send(event, next);
          }}
          onBlur={event => {
            refresh();
            if (!props.onBlur) return;
            const input = event.currentTarget;
            const previous = input.value;
            const setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value",
            )!.set!;
            setter.call(input, latestValue.current);
            try {
              props.onBlur(event);
            } finally {
              setter.call(input, previous);
            }
          }}
        />
      </div>
    );
  },
);
AppraisalDateInput.displayName = "AppraisalDateInput";