import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Briefing from "@/modules/crew-pool/components/BriefingLiveSubmissionHost";
import Debriefing from "@/modules/crew-pool/components/DebriefingLiveSubmissionHost";
import Interview from "@/modules/recruitment/components/InterviewLiveSubmissionHost";
import { CompanySubmissionRenderer } from "@/components/configured-form/companySubmissionContract";
import { companyFixture, formFamilies, legacyFixture, type FormFamily, type StoredPoint } from "./fixtures";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiRequest: request }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ roleName: "Admin", roleId: "admin", userType: "Office" }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/configured-form/CompanyPdfActions", () => ({ CompanyPdfActions: () => null }));
afterEach(() => { request.mockReset(); vi.unstubAllGlobals(); });

const hosts = { briefing: Briefing, debriefing: Debriefing, interview: Interview, company: CompanySubmissionRenderer };

function setup(family: FormFamily, matrix: boolean, submitted = true) {
  const stored: StoredPoint = { comment: "Saved point observation", value: "yes", submitted };
  const fixture = () => family === "company" ? companyFixture(stored, matrix) : legacyFixture(stored, matrix);
  const json = () => Promise.resolve({ ok: true, json: async () => structuredClone(fixture()) });
  vi.stubGlobal("fetch", vi.fn(json));
  request.mockImplementation(async (method: string, url: string, body?: any) => {
    if (method === "GET") return json();
    if (url.endsWith("/answers")) {
      for (const answer of body.answers) {
        if (answer.questionUuid === "point") {
          stored.value = answer.value;
          if (answer.comment !== undefined) stored.comment = answer.comment;
        }
      }
    } else if (url.endsWith("/submit")) stored.submitted = true;
    else throw new Error(`Unexpected write ${method} ${url}`);
    return { ok: true, json: async () => ({}) };
  });
  const Host = hosts[family];
  const ui = (key = "first") => <QueryClientProvider
    key={key} client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <Host submissionUuid="saved" onBack={() => {}} />
  </QueryClientProvider>;
  const mounted = render(ui());
  const writes = () => request.mock.calls.filter(([method]) => method !== "GET");
  return { ...mounted, ui, writes, stored };
}

for (const family of formFamilies) {
  describe(`${family} real adapter with actual renderer`, () => {
    it.each([false, true])("loads submitted comments and selected responses after reopening; matrix=%s", async matrix => {
      const { rerender, ui, writes } = setup(family, matrix);
      expect(await screen.findByTestId("preview-comment-display-point")).toHaveTextContent("Saved point observation");
      expect(screen.queryByTestId("preview-comment-point")).toBeNull();
      expect(screen.queryByTestId("button-preview-comment-point")).toBeNull();
      if (matrix) expect(screen.getByTestId("matrix-option-point-1")).toBeChecked();
      else expect(screen.getByTestId("preview-response-point")).toHaveTextContent("Yes");
      rerender(ui("reopened"));
      expect(await screen.findByTestId("preview-comment-display-point")).toHaveTextContent("Saved point observation");
      expect(writes()).toHaveLength(0);
    });

    it("submits an edited comment, then reloads the persisted response without another write", async () => {
      const { rerender, ui, writes, stored } = setup(family, false, false);
      fireEvent.click(await screen.findByTestId("preview-comment-display-point"));
      fireEvent.change(screen.getByTestId("preview-comment-point"), { target: { value: "Submitted observation" } });
      fireEvent.blur(screen.getByTestId("preview-comment-point"));
      fireEvent.click(screen.getByRole("button", { name: "Submit", exact: true }));
      fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit", exact: true }));
      await waitFor(() => expect(stored.submitted).toBe(true));
      await waitFor(() => expect(screen.queryByTestId("button-preview-comment-point")).toBeNull());
      expect(stored.comment).toBe("Submitted observation");
      expect(stored.value).toBe("yes");
      expect(writes().some(([method, url, body]) =>
        method === "PUT" && url.endsWith("/answers") &&
        body.answers.some((answer: any) => answer.questionUuid === "point" &&
          answer.comment === "Submitted observation" && answer.value === "yes"),
      )).toBe(true);
      const count = writes().length;
      rerender(ui("reopened"));
      expect(await screen.findByTestId("preview-comment-display-point")).toHaveTextContent("Submitted observation");
      expect(screen.queryByTestId("preview-comment-point")).toBeNull();
      expect(writes()).toHaveLength(count);
    });
  });
}
