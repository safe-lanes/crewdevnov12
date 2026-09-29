import React, { useRef } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../../../client/src/components/ui/form";
import { parseManualDate } from "../../../client/src/components/ui/formatted-date-input";
import { DaDateInput } from "../../../client/src/modules/drugs-alcohol/DaDateInput";

// This is a RHF/DOM harness, NOT a render of the complete D&A form. It executes
// the actual save guard from that form; it cannot assert its API, schema, or UI.
const formSource = readFileSync(
  resolve(process.cwd(), "client/src/modules/drugs-alcohol/DrugAlcoholTestForm_v2.tsx"),
  "utf8",
);
const guardStart = formSource.indexOf("  const canSaveDisplayedDates = () => {");
const guardEnd = formSource.indexOf("  const handleSaveDraft = () => {", guardStart);
if (guardStart < 0 || guardEnd < 0) {
  throw new Error("D&A save guard boundaries changed; update integration tests");
}
const guardSource = ts.transpileModule(
  formSource.slice(guardStart, guardEnd),
  { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
).outputText;

type Values = {
  externalTestResultsDate: string;
  testingEquipment: { lastCalibrated: string }[];
  personnelTested: { alcoholTest: { date: string }; drugTest: { date: string } }[];
};

function Harness({
  onSaveDraft,
  onSubmit,
  toast,
  initial,
  min,
  locked = false,
}: {
  onSaveDraft: (value: Values) => void;
  onSubmit: (value: Values) => void;
  toast: (options: { title: string; description: string }) => void;
  initial?: Partial<Values>;
  min?: string;
  locked?: boolean;
}) {
  const form = useForm<Values>({
    defaultValues: {
      externalTestResultsDate: "",
      testingEquipment: [{ lastCalibrated: "" }, { lastCalibrated: "" }],
      personnelTested: [
        { alcoholTest: { date: "" }, drugTest: { date: "" } },
        { alcoholTest: { date: "" }, drugTest: { date: "" } },
      ],
      ...initial,
    },
  });
  const dateFormRef = useRef<HTMLFormElement>(null);
  const canSaveDisplayedDates = new Function(
    "form", "dateFormRef", "parseManualDate", "toast",
    `${guardSource}\nreturn canSaveDisplayedDates;`,
  )(form, dateFormRef, parseManualDate, toast) as () => boolean;
  const equipment = useFieldArray({ control: form.control, name: "testingEquipment" });
  const personnel = useFieldArray({ control: form.control, name: "personnelTested" });
  const save = (action: (data: Values) => void) => {
    if (canSaveDisplayedDates()) action(form.getValues());
  };
  return (
    <Form {...form}>
      <form ref={dateFormRef} onSubmit={event => { event.preventDefault(); save(onSubmit); }}>
        <fieldset disabled={locked}>
          <FormField control={form.control} name="externalTestResultsDate" render={({ field }) => (
            <FormItem><FormLabel>External results</FormLabel><FormControl>
              <DaDateInput {...field} value={field.value ?? ""} label="Date external test results received"
                min={min} disabled={locked} data-testid="external"
                onChange={event => {
                  const value = event.target.value;
                  if (min && value && value < min) return;
                  field.onChange(event);
                }} />
            </FormControl></FormItem>
          )} />
          {equipment.fields.map((row, index) => (
            <FormField key={row.id} control={form.control} name={`testingEquipment.${index}.lastCalibrated`} render={({ field }) => (
              <FormItem><FormControl><DaDateInput {...field} value={field.value ?? ""}
                label="Equipment last calibrated" disabled={locked} data-testid={`equipment-${index}`} />
              </FormControl></FormItem>
            )} />
          ))}
          {personnel.fields.map((row, index) => (
            <React.Fragment key={row.id}>
              {(["alcoholTest", "drugTest"] as const).map(kind => (
                <FormField key={kind} control={form.control}
                  name={`personnelTested.${index}.${kind}.date`} render={({ field }) => (
                    <FormItem><FormControl><DaDateInput {...field} value={field.value ?? ""}
                      label={`Personnel ${kind} date`} disabled={locked}
                      data-testid={`${kind}-${index}`} /></FormControl></FormItem>
                  )} />
              ))}
            </React.Fragment>
          ))}
          <input aria-label="Unrelated Group 1 value" defaultValue="untouched" />
          <button type="button" onClick={() => form.setValue("personnelTested.0.alcoholTest.date", "2026-09-30")}>Auto fill</button>
          <button type="button" onClick={() => equipment.remove(0)}>Remove equipment</button>
          <button type="button" onClick={() => equipment.move(0, 1)}>Move equipment</button>
          <button type="button" onClick={() => personnel.remove(0)}>Remove personnel</button>
          <button type="button" onClick={() => personnel.move(0, 1)}>Move personnel</button>
        </fieldset>
        <button type="button" onClick={() => save(onSaveDraft)}>Save Draft</button>
        <button type="submit">Submit</button>
      </form>
    </Form>
  );
}

let toast: ReturnType<typeof vi.fn>;
let draft: ReturnType<typeof vi.fn>;
let submit: ReturnType<typeof vi.fn>;
function mount(props: Partial<React.ComponentProps<typeof Harness>> = {}) {
  render(<Harness toast={toast} onSaveDraft={draft} onSubmit={submit} {...props} />);
}
function edit(testId: string, value: string) {
  fireEvent.change(screen.getByTestId(`${testId}-manual`), { target: { value } });
}

beforeEach(() => {
  toast = vi.fn();
  draft = vi.fn();
  submit = vi.fn();
  // happy-dom has no layout; give visible inputs a rectangle for the real guard.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
    return this.closest("[hidden]") ? [] as unknown as DOMRectList : [{}] as unknown as DOMRectList;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("D&A actual save guard with RHF and the real date adapter (not the full form)", () => {
  it.each(["Save Draft", "Submit"])("blocks %s on a malformed edited date without saving its old accepted value", action => {
    mount({ initial: { testingEquipment: [{ lastCalibrated: "2026-09-24" }] } });
    edit("equipment-0", "not a date");
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(draft).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Date not accepted" }));
    expect(document.activeElement).toBe(screen.getByTestId("equipment-0-manual"));
  });

  it("allows an untouched legacy value and intentional clearing, leaving unrelated Group 1 input unchanged", () => {
    mount({ initial: {
      externalTestResultsDate: "legacy-value",
      testingEquipment: [{ lastCalibrated: "2026-09-24" }],
    } });
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(draft).toHaveBeenCalledWith(expect.objectContaining({
      externalTestResultsDate: "legacy-value",
    }));
    edit("equipment-0", "");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      testingEquipment: [{ lastCalibrated: "" }],
    }));
    expect(screen.getByRole("textbox", { name: "Unrelated Group 1 value" })).toHaveValue("untouched");
    expect(toast).not.toHaveBeenCalled();
  });

  it("rejects valid displayed text that the external-results minimum handler declined, but permits clearing", () => {
    mount({ min: "2026-09-25", initial: { externalTestResultsDate: "2026-09-26" } });
    edit("external", "24-Sep-2026");
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(draft).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
    edit("external", "");
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(draft).toHaveBeenCalledWith(expect.objectContaining({ externalTestResultsDate: "" }));
  });

  it("does not flag programmatic auto-fill as an edit", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Auto fill" }));
    expect(screen.getByTestId("alcoholTest-0-manual")).toHaveValue("30-Sep-2026");
    expect(screen.getByTestId("alcoholTest-0-manual").closest("[data-da-date-field]")).not.toHaveAttribute("data-da-date-edited");
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(draft).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["equipment", "Remove equipment"],
    ["personnel", "Remove personnel"],
  ])("ignores edited dates in removed %s rows", (kind, action) => {
    mount();
    edit(kind === "equipment" ? "equipment-0" : "drugTest-0", "bad");
    fireEvent.click(screen.getByRole("button", { name: action }));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(draft).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([
    ["equipment", "Move equipment", "equipment-1"],
    ["personnel", "Move personnel", "drugTest-1"],
  ])("checks the newly indexed %s field after reordering", (kind, action, moved) => {
    mount();
    edit(kind === "equipment" ? "equipment-0" : "drugTest-0", "bad");
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(screen.getByTestId(`${moved}-manual`)).toHaveValue("bad");
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(draft).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("ignores disabled fields in a locked harness", () => {
    mount({ locked: true, initial: { externalTestResultsDate: "2026-09-26" } });
    expect(screen.getByTestId("external-manual")).toBeDisabled();
    expect(screen.getByTestId("external")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(draft).toHaveBeenCalledTimes(1);
  });
});