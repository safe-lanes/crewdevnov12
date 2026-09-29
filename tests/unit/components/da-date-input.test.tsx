import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DaDateInput } from "../../../client/src/modules/drugs-alcohol/DaDateInput";

afterEach(cleanup);

describe("D&A date adapter", () => {
  it("connects the actual input ref, name, id and specific accessible name", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<DaDateInput ref={ref} name="equipment.0.lastCalibrated" id="calibration" label="Equipment last calibrated" value="" onChange={() => {}} data-testid="date" />);
    const input = screen.getByTestId("date-manual");
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute("name", "equipment.0.lastCalibrated");
    expect(input).toHaveAttribute("id", "calibration");
    expect(input).toHaveAccessibleName("Equipment last calibrated");
    expect(input.closest("[data-da-date-field]")).not.toHaveAttribute("data-da-date-edited");
  });

  it.each([
    ["25-Sep-2026", "2026-09-25"],
    ["25/09/2026", "2026-09-25"],
    ["", ""],
  ])("marks manual edits and emits canonical value for %s", (draft, canonical) => {
    const values: string[] = [];
    render(<DaDateInput name="date" label="Date field" value="2026-09-24" onChange={event => values.push(event.target.value)} data-testid="date" />);
    const input = screen.getByTestId("date-manual");
    fireEvent.change(input, { target: { value: draft } });
    expect(values).toEqual([canonical]);
    expect(input.closest("[data-da-date-field]")).toHaveAttribute("data-da-date-edited", "true");
  });

  it("marks calendar edits", () => {
    const values: string[] = [];
    render(<DaDateInput name="date" label="Date field" value="" onChange={event => values.push(event.target.value)} data-testid="date" />);
    fireEvent.change(screen.getByTestId("date"), { target: { value: "2026-09-25" } });
    expect(values).toEqual(["2026-09-25"]);
    expect(screen.getByTestId("date-manual").closest("[data-da-date-field]")).toHaveAttribute("data-da-date-edited", "true");
  });

  it("preserves specific names and shared validation attributes across invalid edits", () => {
    const change = vi.fn();
    render(<DaDateInput name="date" label="Alcohol test date" value="" onChange={change} aria-describedby="form-error" data-testid="date" />);
    const input = screen.getByTestId("date-manual");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.blur(input);
    expect(change).not.toHaveBeenCalled();
    expect(input).toHaveAccessibleName("Alcohol test date");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(input.getAttribute("aria-describedby")).not.toBe("form-error");
    expect(input.closest("[data-da-date-field]")).toHaveAttribute("aria-describedby", "form-error");
  });

  it("keeps multiple names separate and disables all shared controls", () => {
    render(<><DaDateInput name="alcohol" label="Alcohol date" value="" onChange={() => {}} data-testid="a" disabled /><DaDateInput name="drug" label="Drug date" value="" onChange={() => {}} data-testid="b" /></>);
    expect(screen.getByTestId("a-manual")).toHaveAccessibleName("Alcohol date");
    expect(screen.getByTestId("b-manual")).toHaveAccessibleName("Drug date");
    expect(screen.getByTestId("a-manual")).toBeDisabled();
    expect(screen.getByTestId("a")).toBeDisabled();
  });

  it("updates indexed names and detaches refs", () => {
    const ref = vi.fn();
    const view = render(<DaDateInput ref={ref} name="rows.0.date" label="Row date" value="" onChange={() => {}} data-testid="date" />);
    view.rerender(<DaDateInput ref={ref} name="rows.1.date" label="Row date" value="" onChange={() => {}} data-testid="date" />);
    expect(screen.getByTestId("date-manual")).toHaveAttribute("name", "rows.1.date");
    view.unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });
});