import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FormattedDateInput,
  formatIsoDate,
  parseManualDate,
} from "../../../client/src/components/ui/formatted-date-input";

describe("formatted date parsing", () => {
  it.each([
    ["26-Feb-1980", "1980-02-26"],
    ["26-feb-1980", "1980-02-26"],
    ["26-FEB-1980", "1980-02-26"],
    ["26-02-1980", "1980-02-26"],
    ["1-2-2026", "2026-02-01"],
    ["29-Feb-2024", "2024-02-29"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(parseManualDate(input)).toBe(expected);
  });

  it.each([
    "29-Feb-2025",
    "31-04-2026",
    "00-12-2026",
    "15-13-2026",
    "26-Feb-80",
    "2026-02-26",
    "26/02/2026",
    "26-Fe-2026",
  ])("rejects invalid or unsupported input %s", (input) => {
    expect(parseManualDate(input)).toBeNull();
  });

  it("formats ISO dates without timezone conversion", () => {
    expect(formatIsoDate("1980-02-26")).toBe("26-Feb-1980");
    expect(formatIsoDate("2025-02-29")).toBe("");
  });
});

describe("FormattedDateInput", () => {
  it("emits canonical ISO values for both manual formats", () => {
    const receivedValues: string[] = [];
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      receivedValues.push(event.target.value);
    });
    const { rerender } = render(
      <FormattedDateInput value="" onChange={onChange} data-testid="date" />,
    );

    fireEvent.change(screen.getByTestId("date-manual"), {
      target: { value: "26-Feb-1980" },
    });
    expect(receivedValues.at(-1)).toBe("1980-02-26");
    expect(onChange.mock.calls[0][0].preventDefault).toBeTypeOf("function");
    expect(onChange.mock.calls[0][0].stopPropagation).toBeTypeOf("function");

    rerender(<FormattedDateInput value="" onChange={onChange} data-testid="date" />);
    fireEvent.change(screen.getByTestId("date-manual"), {
      target: { value: "26-02-1980" },
    });
    expect(receivedValues.at(-1)).toBe("1980-02-26");
  });

  it("retains incomplete and invalid drafts without emitting them", () => {
    const onChange = vi.fn();
    render(<FormattedDateInput value="" onChange={onChange} data-testid="date" />);
    const manualInput = screen.getByTestId("date-manual");

    fireEvent.change(manualInput, { target: { value: "31-02" } });
    expect(manualInput).toHaveValue("31-02");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(manualInput);
    expect(manualInput).toHaveAttribute("aria-invalid", "true");
    expect(manualInput).toHaveValue("31-02");
  });

  it("emits an empty value when manually cleared", () => {
    let receivedValue = "not-cleared";
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      receivedValue = event.target.value;
    });
    render(
      <FormattedDateInput value="1980-02-26" onChange={onChange} data-testid="date" />,
    );

    fireEvent.change(screen.getByTestId("date-manual"), { target: { value: "" } });
    expect(receivedValue).toBe("");
  });

  it("keeps calendar selection and native boundary attributes", () => {
    let receivedValue = "";
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      receivedValue = event.target.value;
    });
    render(
      <FormattedDateInput
        value=""
        onChange={onChange}
        min="1980-01-01"
        max="2020-12-31"
        data-testid="date"
      />,
    );
    const calendarInput = screen.getByTestId("date");

    expect(calendarInput).toHaveAttribute("type", "date");
    expect(calendarInput).toHaveAttribute("min", "1980-01-01");
    expect(calendarInput).toHaveAttribute("max", "2020-12-31");

    fireEvent.change(calendarInput, { target: { value: "2000-03-15" } });
    expect(receivedValue).toBe("2000-03-15");
    expect(screen.getByTestId("date-manual")).toHaveValue("15-Mar-2000");
  });

  it("marks out-of-range manual dates invalid while preserving the ISO callback", () => {
    let receivedValue = "";
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      receivedValue = event.target.value;
    });
    render(
      <FormattedDateInput
        value=""
        onChange={onChange}
        max="2000-01-01"
        data-testid="date"
      />,
    );
    const manualInput = screen.getByTestId("date-manual");

    fireEvent.change(manualInput, { target: { value: "02-Jan-2000" } });
    expect(receivedValue).toBe("2000-01-02");
    fireEvent.blur(manualInput);
    expect(manualInput).toHaveAttribute("aria-invalid", "true");
  });

  it("preserves disabled and blur behavior", () => {
    const onChange = vi.fn();
    let blurredValue = "";
    const onBlur = vi.fn((event: React.FocusEvent<HTMLInputElement>) => {
      blurredValue = event.target.value;
    });
    const { rerender } = render(
      <FormattedDateInput
        value="1980-02-26"
        onChange={onChange}
        onBlur={onBlur}
        data-testid="date"
      />,
    );
    fireEvent.blur(screen.getByTestId("date-manual"));
    expect(onBlur).toHaveBeenCalledOnce();
    expect(blurredValue).toBe("1980-02-26");

    rerender(
      <FormattedDateInput
        value="1980-02-26"
        onChange={onChange}
        disabled
        data-testid="date"
      />,
    );
    expect(screen.getByTestId("date-manual")).toBeDisabled();
    expect(screen.getByTestId("date")).toBeDisabled();
    expect(screen.getByRole("button", { name: /choose date/i })).toBeDisabled();
  });

  it("restores the controlled value when the parent rejects a valid edit", () => {
    const onChange = vi.fn();
    render(
      <FormattedDateInput
        value="1980-02-26"
        onChange={onChange}
        data-testid="date"
      />,
    );
    const manualInput = screen.getByTestId("date-manual");

    fireEvent.change(manualInput, { target: { value: "15-Mar-2000" } });
    expect(manualInput).toHaveValue("15-Mar-2000");

    fireEvent.blur(manualInput);
    expect(manualInput).toHaveValue("26-Feb-1980");
  });

  it("delivers calendar change before a genuine blur with the selected value", () => {
    const calls: string[] = [];
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      calls.push(`change:${event.target.value}`);
    });
    const onBlur = vi.fn((event: React.FocusEvent<HTMLInputElement>) => {
      calls.push(`blur:${event.target.value}`);
      expect(event.preventDefault).toBeTypeOf("function");
    });
    render(
      <FormattedDateInput
        value=""
        onChange={onChange}
        onBlur={onBlur}
        data-testid="date"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /choose date/i }));
    fireEvent.change(screen.getByTestId("date"), {
      target: { value: "2000-03-15" },
    });

    expect(calls).toEqual(["change:2000-03-15", "blur:2000-03-15"]);
  });
});