import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { PartA } from "@/components/appraisal-form-parts/PartA";

vi.mock("@/hooks/useCompanyRanks", () => ({
  useCompanyRanks: () => ({ isLoading: false, error: null, rankOptions: [] }),
}));
vi.mock("@/hooks/v2/useMasterDataV2", () => ({
  withLegacyAppraisalType: (items: unknown[]) => items,
}));

let form: ReturnType<typeof useForm<any>>;
function Harness({ locked = false }: { locked?: boolean }) {
  form = useForm<any>({ defaultValues: {
    seafarersName: "Test Crew", seafarersRank: "", nationality: "",
    vessel: "", signOn: "", appraisalType: "", appraisalPeriodFrom: "",
    appraisalPeriodTo: "", primaryAppraiser: "", personalityIndexCategory: "",
  } });
  return <Form {...form}><PartA form={form} partRef={{ current: null }}
    vessels={[]} availableRanks={[]} appraisalTypes={[]} isFieldVisible={() => true}
    isLockForm={locked} isPostStage2={locked} isPostStage3={false} /></Form>;
}
afterEach(cleanup);
const appraiser = () => screen.getByTestId("select-primary-appraiser");
const category = () => screen.getByTestId("select-pi-category");
function reset(values: Record<string, unknown>) {
  act(() => form.reset({ ...form.getValues(), ...values }));
}

describe("Appraisal draft dropdown placeholders", () => {
  it("shows both placeholders before saving", () => {
    render(<Harness />);
    expect(appraiser()).toHaveTextContent("Select appraiser");
    expect(category()).toHaveTextContent("Select category");
  });
  it.each([null, undefined, ""])("keeps placeholders after hydration with %s", value => {
    render(<Harness />);
    reset({ primaryAppraiser: value, personalityIndexCategory: value });
    expect(appraiser()).toHaveTextContent("Select appraiser");
    expect(category()).toHaveTextContent("Select category");
    expect(form.formState.isDirty).toBe(false);
  });
  it("preserves saved selections instead of showing placeholders", () => {
    render(<Harness />);
    reset({ primaryAppraiser: "master", personalityIndexCategory: "dominance" });
    expect(appraiser()).toHaveTextContent("Master");
    expect(category()).toHaveTextContent("Dominance");
    expect(form.getValues("primaryAppraiser")).toBe("master");
    expect(form.getValues("personalityIndexCategory")).toBe("dominance");
  });
  it("handles repeated save/reload and clearing previously selected fields", () => {
    render(<Harness />);
    reset({ primaryAppraiser: "chief-officer", personalityIndexCategory: "compliance" });
    expect(appraiser()).toHaveTextContent("Chief Officer");
    expect(category()).toHaveTextContent("Compliance");
    for (let i = 0; i < 2; i++) {
      reset({ primaryAppraiser: null, personalityIndexCategory: null });
      expect(appraiser()).toHaveTextContent("Select appraiser");
      expect(category()).toHaveTextContent("Select category");
    }
  });
  it("keeps section locking unchanged while displaying blank placeholders", () => {
    render(<Harness locked />);
    reset({ primaryAppraiser: null, personalityIndexCategory: null });
    expect(appraiser()).toBeDisabled();
    expect(category()).toBeDisabled();
    expect(appraiser()).toHaveTextContent("Select appraiser");
    expect(category()).toHaveTextContent("Select category");
  });
  it("shows a selected field alongside the other field's placeholder", () => {
    render(<Harness />);
    reset({ primaryAppraiser: "master", personalityIndexCategory: null });
    expect(appraiser()).toHaveTextContent("Master");
    expect(category()).toHaveTextContent("Select category");
  });
});
