import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WageScaleDateInput from "../../client/src/modules/accounts/pages/WageScaleDateInput";
import {
  monthEnd, minimumWageStart, getWageScaleDateError, revisionMinimum,
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
    ["2026-10-01", null, false, false, false],
    ["2026-11-01", null, true, false, false],
    ["2026-12-01", null, true, true, true],
    ["2026-11-15", null, false, false, false],
    ["2026-11-01", "2026-11-20", false, false, false],
    ["2026-12-01", "2026-11-30", false, false, false],
  ])("validates %s / %s", (from, to, revision, activation, valid) => {
    expect(getWageScaleDateError(from as string | null, to as string | null, {
      revision: revision as boolean, activation: activation as boolean, now,
    }) === null).toBe(valid);
  });
  it("uses UTC and crosses December", () => {
    expect(minimumWageStart(false, new Date("2026-12-01T00:15:00+05:30"))).toBe("2026-11-01");
    expect(minimumWageStart(true, new Date("2026-12-31T23:59:00Z"))).toBe("2027-01-01");
  });
  it("ignores predecessor end when selecting revision minimum", () => {
    expect(revisionMinimum({
      effectiveFrom: "2026-01-15", effectiveTo: "2029-12-31",
    }, now)).toBe("2026-12-01");
  });
  it("requires a month after a future predecessor's start", () => {
    expect(revisionMinimum({ effectiveFrom: "2027-03-01" }, now)).toBe("2027-04-01");
  });
});

function Field({ edge = "start", initial = "", min = "2026-11-01", disabled = false }: {
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
    render(<Field />);
    expect(screen.getByTestId("month")).toHaveAttribute("min", "2026-11");
    fireEvent.change(screen.getByTestId("month-manual"), { target: { value: "Oct-2026" } });
    expect(screen.getByText("Save")).toBeDisabled();
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
