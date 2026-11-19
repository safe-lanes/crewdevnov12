import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WageScaleDateInput from "../../client/src/modules/accounts/pages/WageScaleDateInput";
import {
  monthEnd, getWageScaleDateError, getRevisionDateError, revisionMinimum,
} from "../../shared/v2/accounts/wageScaleRevisionDates";

const now = new Date("2026-11-06T12:00:00Z");
describe("Wage Scale month rules", () => {
  it.each([
    ["2028-02", "2028-02-29"], ["2027-02", "2027-02-28"],
    ["2026-12", "2026-12-31"], ["9999-12", "9999-12-31"],
  ])("stores month end for %s", (month, expected) => expect(monthEnd(month)).toBe(expected));
  it.each([
    [null, null, false, false, true],
    [null, null, false, true, false],
    ["2026-11-01", null, false, false, true],
    ["2026-10-01", null, false, false, true],
    ["2020-01-01", "2020-02-29", false, false, true],
    ["2026-11-01", null, true, false, true],
    ["2026-12-01", null, true, true, true],
    ["2026-11-15", null, false, false, false],
    ["2026-11-01", "2026-11-20", false, false, false],
    ["2026-12-01", "2026-11-30", false, false, false],
  ])("validates %s / %s", (from, to, revision, activation, valid) => {
    expect(getWageScaleDateError(from as string | null, to as string | null, {
      revision: revision as boolean, activation: activation as boolean, now,
    }) === null).toBe(valid);
  });
  it("ignores predecessor end when selecting revision minimum", () => {
    expect(revisionMinimum({
      effectiveFrom: "2026-01-15", effectiveTo: "2029-12-31",
    })).toBe("2026-02-01");
  });
  it("requires a month after a future predecessor's start", () => {
    expect(revisionMinimum({ effectiveFrom: "2027-03-01" })).toBe("2027-04-01");
  });
  it("allows historical revisions while retaining predecessor chronology", () => {
    expect(getRevisionDateError({ effectiveFrom: "2020-01-01" }, "2020-02-01")).toBeNull();
    expect(getRevisionDateError({ effectiveFrom: "2020-01-01" }, "2020-01-01")).not.toBeNull();
  });
  it("retains end-before-start validation for historical months", () => {
    expect(getWageScaleDateError("2020-03-01", "2020-02-29"))
      .toBe("Effective To must be on or after Effective From.");
  });
});

function Field({ edge = "start", initial = "", min, disabled = false }: {
  edge?: "start" | "end"; initial?: string; min?: string; disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [valid, setValid] = useState(true);
  return <>
    <WageScaleDateInput value={value} resetKey="test" edge={edge} min={min}
      disabled={disabled} onChange={e => setValue(e.target.value)}
      onDraftValidityChange={setValid} data-testid="month" />
    <output data-testid="iso">{value}</output>
    <button disabled={!valid}>Save</button>
  </>;
}

describe("actual shared month selector binding", () => {
  it("normalizes typed start and invalid typing blocks stale accepted value", () => {
    render(<Field />);
    fireEvent.change(screen.getByTestId("month-manual"), { target: { value: "Nov-2026" } });
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-01");
    expect(screen.getByText("Save")).toBeEnabled();
    fireEvent.change(screen.getByTestId("month-manual"), { target: { value: "bad" } });
    expect(screen.getByText("Save")).toBeDisabled();
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-01");
    fireEvent.blur(screen.getByTestId("month-manual"));
    expect(screen.getByTestId("month-manual")).toHaveValue("bad");
    fireEvent.change(screen.getByTestId("month-manual"), { target: { value: "" } });
    expect(screen.getByTestId("iso")).toBeEmptyDOMElement();
    expect(screen.getByText("Save")).toBeEnabled();
  });
  it("converts native month selection to a leap-year end date", () => {
    render(<Field edge="end" />);
    fireEvent.input(screen.getByTestId("month"), { target: { value: "2028-02" } });
    expect(screen.getByTestId("iso")).toHaveTextContent("2028-02-29");
  });
  it("rejects past typed months and retains picker limits", () => {
    render(<Field min="2026-11-01" />);
    expect(screen.getByTestId("month")).toHaveAttribute("min", "2026-11");
    fireEvent.change(screen.getByTestId("month-manual"), { target: { value: "Oct-2026" } });
    expect(screen.getByText("Save")).toBeDisabled();
  });
  it.each(["Jan-2020", "Nov-2026", "Dec-2090"])("allows unrestricted Effective From %s", (month) => {
    render(<Field />);
    expect(screen.getByTestId("month")).toHaveAttribute("type", "month");
    expect(screen.getByTestId("month")).not.toHaveAttribute("min");
    fireEvent.change(screen.getByTestId("month-manual"), { target: { value: month } });
    expect(screen.getByText("Save")).toBeEnabled();
    expect(screen.getByTestId("iso").textContent).toMatch(/-01$/);
  });
  it("accepts historical native picker selection", () => {
    render(<Field />);
    fireEvent.input(screen.getByTestId("month"), { target: { value: "2020-01" } });
    expect(screen.getByTestId("iso")).toHaveTextContent("2020-01-01");
    expect(screen.getByText("Save")).toBeEnabled();
  });
  it("requires correction of a legacy midmonth draft", () => {
    render(<Field initial="2026-11-15" />);
    expect(screen.getByText("Save")).toBeDisabled();
    fireEvent.input(screen.getByTestId("month"), { target: { value: "2026-11" } });
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-01");
    expect(screen.getByText("Save")).toBeEnabled();
  });
  it("does not mutate historical disabled dates", () => {
    const onChange = vi.fn();
    render(<WageScaleDateInput value="2020-01-15" resetKey="readonly"
      disabled min="2026-11-01" onChange={onChange} data-testid="month" />);
    expect(screen.getByTestId("month-manual")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
