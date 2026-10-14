import React from "react";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardCompanyForms, useOnboardFormCounts } from "../../client/src/modules/vessel/components/OnboardCompanyForms";

vi.mock("../../client/src/components/configured-form/companySubmissionContract", () => ({
  CompanySubmissionRenderer: ({ onBack }: any) => <button onClick={onBack}>Return from saved form</button>,
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const old = { submissionUuid: "original", stageKey: "on_board", status: "voided", formUuid: "form",
  formName: "Retired test form", formArchivedAt: "2026-10-03", replacementHistory: [] };
function mount(element: React.ReactElement) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{element}</QueryClientProvider>);
}
function Count() {
  const query = useOnboardFormCounts(["assignment"]);
  return <p>{query.error ? query.error.message : query.data?.assignment ?? "Loading"}</p>;
}
describe("Crew List popup preserves retained history and refreshes the column", () => {
  it("refreshes completion and current eligibility when the embedded-form popup is closed and reopened", async () => {
    let completed = false;
    const fetch = vi.fn(async (input: RequestInfo | URL) => String(input).includes("eligible-forms")
      ? reply(completed ? [] : [{ formUuid: "form", formVersionUuid: "version", formName: "Saved form", versionNo: "01" }])
      : reply({ submissions: [{ ...old, formName: "Saved form", status: completed ? "completed" : "in_progress", formArchivedAt: null }] }));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const popup = () => <QueryClientProvider client={client}><OnboardCompanyForms assignmentUuid="assignment" /></QueryClientProvider>;
    const first = render(popup());
    await screen.findByText("Saved form · in_progress");
    await waitFor(() => expect(screen.getByTestId("select-onboard-form-version").querySelectorAll("option").length).toBe(2));
    first.unmount();
    completed = true;
    render(popup());
    await screen.findByText("Saved form · completed");
    await screen.findByText("No released, lifecycle-valid on-board forms are eligible.");
    expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(4);
    client.clear();
  });
  it("includes voided history, excludes other stages and explicitly labels the total", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("eligible-forms")
      ? reply([]) : reply({ submissions: [old,
        { ...old, submissionUuid: "before", formName: "Before-joining declaration", stageKey: "before_joining" },
        { ...old, submissionUuid: "off", formName: "Sign-off declaration", stageKey: "at_sign_off" }] })));
    mount(<OnboardCompanyForms assignmentUuid="assignment" />);
    await screen.findByText("Saved forms and retained history (total including voided: 1)");
    expect(screen.getByText("Retired test form · voided")).toBeTruthy();
    expect(screen.getByText("No replacement — form retired")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Read form" })).toBeTruthy();
    expect(screen.queryByText("Before-joining declaration · voided")).toBeNull();
    expect(screen.queryByText("Sign-off declaration · voided")).toBeNull();
  });

  it("uses scoped counts and refreshes counts after creation and renderer return", async () => {
    let counts = 0, created = false;
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("submission-counts")) {
        expect(JSON.parse(String(init?.body))).toEqual({ subjectRefs: ["assignment"], stageKey: "on_board" });
        counts++;
        return reply({ assignment: created ? 1 : 0 });
      }
      if (url.includes("eligible-forms")) return reply([{ formUuid: "form", formVersionUuid: "version", formName: "Active test form", versionNo: "01" }]);
      if (init?.method === "POST") { created = true; return reply({ submissionUuid: "replacement" }, 201); }
      return reply({ submissions: [old] });
    });
    vi.stubGlobal("fetch", fetch);
    mount(<><Count /><OnboardCompanyForms assignmentUuid="assignment" /></>);
    await screen.findByText("0");
    await waitFor(() => expect(screen.getByTestId("select-onboard-form-version").querySelectorAll("option").length).toBe(2));
    fireEvent.change(screen.getByTestId("select-onboard-form-version"), { target: { value: "version" } });
    fireEvent.click(screen.getByTestId("button-start-onboard-form"));
    await screen.findByText("1");
    const afterCreation = counts;
    fireEvent.click(screen.getByRole("button", { name: "Return from saved form" }));
    await waitFor(() => expect(counts).toBeGreaterThan(afterCreation));
    expect(screen.getByText("Retired test form · voided")).toBeTruthy();
  });

  it("shows permission/load failures rather than manufacturing a zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ message: "Permission refused" }, 403)));
    mount(<Count />);
    await screen.findByText(/Permission refused/);
    expect(screen.queryByText("0")).toBeNull();
  });
});