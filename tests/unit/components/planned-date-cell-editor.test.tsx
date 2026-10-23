import React from "react";
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type GridApi } from "ag-grid-community";
import { PlannedDateCellEditor } from "../../../client/src/modules/drugs-alcohol/PlannedDateCellEditor";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("../../../client/src/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

ModuleRegistry.registerModules([AllCommunityModule]);
beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
});
afterEach(() => { cleanup(); toast.mockClear(); });
afterAll(() => vi.restoreAllMocks());

async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
}

async function setup(summary = false) {
  let api: GridApi | undefined;
  const changed = vi.fn();
  render(<div style={{ height: 400, width: 600 }}><AgGridReact
    theme="legacy"
    suppressCellFocus={summary}
    rowData={[{ plannedDate: "24-Sep-2026", other: "x" }]}
    columnDefs={[
      { field: "plannedDate", editable: true, cellEditor: PlannedDateCellEditor, singleClickEdit: true, width: 180, minWidth: 180, suppressAutoSize: true, suppressSizeToFit: true },
      { field: "other", editable: true },
    ]}
    onGridReady={event => { api = event.api; }}
    onCellValueChanged={changed}
  /></div>);
  await vi.waitFor(() => expect(api).toBeTruthy());
  act(() => api!.startEditingCell({ rowIndex: 0, colKey: "plannedDate" }));
  await vi.waitFor(() => expect(screen.getByTestId("input-planned-date-manual")).toBeTruthy());
  // AG Grid attaches its editor and tooltip on a deferred tick.
  await settle();
  return { api: api!, changed, input: screen.getByTestId("input-planned-date-manual") };
}

describe("planned date editor with real AG Grid (simulated layout, no server requests)", () => {
  it.each([["25-Sep-2026", "25-Sep-2026"], ["", ""]])("commits %s once on outside pointer, not on typing", async (draft, expected) => {
    const { input, changed } = await setup();
    fireEvent.change(input, { target: { value: draft } });
    expect(changed).not.toHaveBeenCalled();
    expect(fireEvent.pointerDown(document.body)).toBe(true);
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(changed.mock.calls[0][0].newValue).toBe(expected);
    fireEvent.pointerDown(document.body);
    expect(changed).toHaveBeenCalledTimes(1);
    await settle();
  });

  it("cancels invalid text after a valid edit without blocking the outside action", async () => {
    const { input, changed, api } = await setup();
    fireEvent.change(input, { target: { value: "25-Sep-2026" } });
    fireEvent.change(input, { target: { value: "invalid" } });
    expect(fireEvent.pointerDown(document.body)).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    expect(api.getDisplayedRowAtIndex(0)!.data.plannedDate).toBe("24-Sep-2026");
    expect(toast).toHaveBeenCalledTimes(1);
    await settle();
  });

  it("does not emit a change for an unchanged exit", async () => {
    const { changed } = await setup();
    fireEvent.pointerDown(document.body);
    expect(changed).not.toHaveBeenCalled();
    await settle();
  });

  it("cancels Escape without saving or warning", async () => {
    const { input, changed } = await setup();
    fireEvent.change(input, { target: { value: "25-Sep-2026" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(changed).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    await settle();
  });

  it("keeps invalid Enter open and commits a corrected date in Summary-style mode", async () => {
    const { input, changed, api } = await setup(true);
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(api.getEditingCells()).toHaveLength(1);
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "25-Sep-2026" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    await settle();
  });

  it("supports internal Tab/ShiftTab and boundary Tab with Summary-style focus", async () => {
    const { input, changed } = await setup(true);
    fireEvent.change(input, { target: { value: "25-Sep-2026" } });
    fireEvent.keyDown(input, { key: "Tab" });
    const button = screen.getByRole("button", { name: "Choose date from calendar" });
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Tab" });
    fireEvent.keyDown(button, { key: "Tab" });
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    await settle();
  });

  it("does not commit on simulated calendar selection or interpret native Escape as grid cancellation", async () => {
    const { api, changed } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Choose date from calendar" }));
    const calendar = screen.getByTestId("input-planned-date");
    fireEvent.keyDown(calendar, { key: "Escape" });
    expect(api.getEditingCells()).toHaveLength(1);
    fireEvent.change(calendar, { target: { value: "2026-09-26" } });
    expect(changed).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(changed.mock.calls[0][0].newValue).toBe("26-Sep-2026");
    await settle();
  });

  it("rejects forced invalid exits and cleans up document listeners", async () => {
    const { input, api, changed } = await setup();
    fireEvent.change(input, { target: { value: "invalid" } });
    act(() => api.stopEditing());
    expect(changed).not.toHaveBeenCalled();
    await settle();
    cleanup();
    toast.mockClear();
    fireEvent.pointerDown(document.body);
    expect(toast).not.toHaveBeenCalled();
  });
});