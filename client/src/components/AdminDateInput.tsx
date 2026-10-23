import * as React from "react";
import {
  FormattedDateInput,
  formatIsoDate,
} from "@/components/ui/formatted-date-input";

type SharedDateProps = Extract<
  React.ComponentPropsWithoutRef<typeof FormattedDateInput>,
  { mode?: "date" }
>;

type AdminDateInputProps = Omit<
  SharedDateProps,
  "mode" | "acceptCalendarInputEvents"
>;

export function AdminDateInput(props: AdminDateInputProps) {
  const handleBlurCapture: React.FocusEventHandler<HTMLDivElement> = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "date") return;
    if (props.disabled || input.matches(":disabled") || !input.validity.valid) return;

    const pendingValue = input.value;
    if (pendingValue === props.value) return;
    // A browser-generated blank is not proof that the user cleared the date.
    if (
      pendingValue === "" &&
      props.value !== "" &&
      !formatIsoDate(props.value)
    ) {
      return;
    }
    if (pendingValue !== "" && !formatIsoDate(pendingValue)) return;

    // Process the pending selection before the shared blur handler.
    // Do not stop propagation: the shared blur cleanup must still run.
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <div style={{ display: "contents" }} onBlurCapture={handleBlurCapture}>
      <FormattedDateInput {...props} mode="date" acceptCalendarInputEvents />
    </div>
  );
}