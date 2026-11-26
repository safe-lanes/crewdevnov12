import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Briefing from "@/modules/crew-pool/components/BriefingLiveSubmissionHost";
import Debriefing from "@/modules/crew-pool/components/DebriefingLiveSubmissionHost";
import Interview from "@/modules/recruitment/components/InterviewLiveSubmissionHost";
import { CompanySubmissionRenderer } from "@/components/configured-form/companySubmissionContract";
import { SectionDraftActions } from "@/components/configured-form/SectionDraftActions";
import { companyFixture, formFamilies, legacyFixture } from "./fixtures";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiRequest: request }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ roleName: "Admin", roleId: "admin", userType: "Office" }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/configured-form/CompanyPdfActions", () => ({ CompanyPdfActions: () => null }));
afterEach(() => { request.mockReset(); vi.unstubAllGlobals(); });
const hosts = { briefing: Briefing, debriefing: Debriefing, interview: Interview, company: CompanySubmissionRenderer };
const receipt = { lastDraftSavedAt: "2026-11-20T10:00:00.000Z", lastDraftSavedByUuid: "actor", lastDraftSavedByName: "Test Saver" };

for (const family of formFamilies) {
  function setup(fail = false) {
    let saved = false;
    let complete: (() => void) | undefined;
    const fixture = () => {
      const data: any = family === "company"
        ? companyFixture({ comment: "Keep comment", value: "yes", submitted: false }, false)
        : legacyFixture({ comment: "Keep comment", value: "yes", submitted: false }, false);
      if (saved) Object.assign((data.states || data.section_states)[0], family === "company" ? receipt : {
        last_draft_saved_at: receipt.lastDraftSavedAt,
        last_draft_saved_by_uuid: receipt.lastDraftSavedByUuid,
        last_draft_saved_by_name: receipt.lastDraftSavedByName,
      });
      return data;
    };
    const json = async () => ({ ok: true, json: async () => fixture() });
    vi.stubGlobal("fetch", vi.fn(json));
    request.mockImplementation(async (method: string, _url: string, body: any) => {
      if (method === "GET") return json();
      if (body?.explicitDraftSave) {
        await new Promise<void>(resolve => { complete = resolve; });
        if (fail) throw new Error("Save rejected");
        saved = true;
        return { ok: true, json: async () => receipt };
      }
      return { ok: true, json: async () => ({}) };
    });
    const Host = hosts[family];
    const ui = (key: string) => <QueryClientProvider key={key} client={new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })}><Host submissionUuid="saved" onBack={() => {}} /></QueryClientProvider>;
    return { ...render(ui("first")), ui, finish: () => complete?.() };
  }
  it(`${family}: explicitly saves an already-autosaved section, blocks overlap, retains Draft after reopening`, async () => {
    const view = setup();
    expect(await screen.findByText("In progress", { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save draft", exact: true }));
    await waitFor(() => expect(request.mock.calls.some(([, , b]) => b?.explicitDraftSave)).toBe(true));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
    view.finish();
    expect(await screen.findByText("Draft saved successfully")).toBeVisible();
    expect(screen.getByText("Last Saved by: Test Saver")).toBeVisible();
    expect(screen.getByText("Draft", { exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit", exact: true })).toBeEnabled();
    view.rerender(view.ui("reopened"));
    expect(await screen.findByText("Last Saved by: Test Saver")).toBeVisible();
    expect(screen.getByTestId("preview-comment-display-point")).toHaveTextContent("Keep comment");
  });
  it(`${family}: reports failed saves without announcing success or clearing entered values`, async () => {
    const view = setup(true);
    fireEvent.click(await screen.findByRole("button", { name: "Save draft", exact: true }));
    await waitFor(() => expect(request.mock.calls.some(([, , b]) => b?.explicitDraftSave)).toBe(true));
    view.finish();
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Draft saved successfully")).toBeNull();
    expect(screen.queryByText("Draft", { exact: true })).toBeNull();
    expect(screen.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
    expect(screen.getByTestId("preview-comment-display-point")).toHaveTextContent("Keep comment");
  });
  it(`${family}: autosaving an edit never announces an explicit draft save`, async () => {
    setup();
    fireEvent.click(await screen.findByTestId("preview-comment-display-point"));
    fireEvent.change(screen.getByTestId("preview-comment-point"), { target: { value: "New local observation" } });
    await waitFor(() => expect(request.mock.calls.some(([method]) => method === "PUT")).toBe(true));
    expect(request.mock.calls.some(([, , body]) => body?.explicitDraftSave)).toBe(false);
    expect(screen.queryByText("Draft saved successfully")).toBeNull();
    expect(screen.queryByText("Draft", { exact: true })).toBeNull();
    expect(screen.getByTestId("preview-comment-point")).toHaveValue("New local observation");
  });
  it(`${family}: an acknowledged explicit save does not depend on a successful follow-up read`, async () => {
    const view = setup();
    await screen.findByText("In progress", { exact: true });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Read unavailable"); }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft", exact: true }));
    await waitFor(() => expect(request.mock.calls.some(([, , b]) => b?.explicitDraftSave)).toBe(true));
    view.finish();
    expect(await screen.findByText("Draft saved successfully")).toBeVisible();
    expect(screen.getByText("Last Saved by: Test Saver")).toBeVisible();
  });
  it(`${family}: a save acknowledgement preserves newer local edits`, async () => {
    const view = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Save draft", exact: true }));
    await waitFor(() => expect(request.mock.calls.some(([, , b]) => b?.explicitDraftSave)).toBe(true));
    fireEvent.click(screen.getByTestId("preview-comment-display-point"));
    fireEvent.change(screen.getByTestId("preview-comment-point"), { target: { value: "Newer edit while saving" } });
    view.finish();
    expect(await screen.findByText("Draft saved successfully")).toBeVisible();
    expect(screen.getByTestId("preview-comment-point")).toHaveValue("Newer edit while saving");
  });
}

it("ignores a late save result after the section action scope changes and prevents duplicate clicks", async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const props = {
    sectionId: "section", readOnly: false, requiresSubmission: true, companyForm: false,
    canSubmit: true, submitSection: vi.fn(),
  };
  const view = render(<SectionDraftActions key="first" {...props} live={{ answers: {}, onAnswerChange: vi.fn(), draftSaveScope: "first", onSaveDraft: save }} />);
  const button = screen.getByRole("button", { name: "Save draft", exact: true });
  fireEvent.click(button); fireEvent.click(button);
  expect(save).toHaveBeenCalledTimes(1);
  view.rerender(<SectionDraftActions key="second" {...props} live={{ answers: {}, onAnswerChange: vi.fn(), draftSaveScope: "second", onSaveDraft: save }} />);
  finish();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(screen.queryByText("Draft saved successfully")).toBeNull();
  expect(screen.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
});
