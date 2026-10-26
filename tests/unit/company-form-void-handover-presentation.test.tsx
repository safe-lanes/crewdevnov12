import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyPdfActions } from "../../client/src/components/configured-form/CompanyPdfActions";

const state = vi.hoisted(() => ({ response: {} as any, post: vi.fn() }));
vi.mock("../../client/src/lib/queryClient", () => ({
  apiRequest: async (method: string, path: string, body: object) => {
    if (method === "POST") {
      state.post(path, body);
      state.response = { ...state.response, handovers: [...state.response.handovers,
        { actorName:"Recorded witness",recordedAt:"2026-10-20T10:00:00Z",fileSha256:"a".repeat(64),
          copyKind:"void_notice",currentNotice:true }] };
    }
    return { json: async () => state.response };
  },
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); state.post.mockClear(); });
function show(fill = true) {
  state.response = { status:"ready",voided:true,canFillIn:fill,fileSha256:"a".repeat(64),originalFileSha256:"b".repeat(64),
    canRetry:false,documentReference:"CF-2026-000005",
    handovers:[{actorName:"Original witness",recordedAt:"2026-10-19T09:00:00Z",fileSha256:"b".repeat(64),copyKind:"original"}] };
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <CompanyPdfActions submissionUuid="record" completed canFillIn={fill} />
  </QueryClientProvider>);
}
describe("void-notice handover presentation", () => {
  it("shows the exact reminder, confirms handover, sends only the annotated fingerprint and clears the reminder", async () => {
    Object.defineProperty(window,"confirm",{configurable:true,writable:true,value:vi.fn(()=>true)});
    show();
    await screen.findByText("A copy was handed to the seafarer on 19-Oct-2026. The void notice has not been handed over.");
    expect(screen.queryByRole("button",{name:"Copy handed to seafarer",exact:true})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Void notice handed to seafarer",exact:true}));
    await waitFor(()=>expect(state.post).toHaveBeenCalledWith(
      "/api/v2/company-form-submissions/record/pdf/void-notice-handover",{fileSha256:"a".repeat(64)}));
    await waitFor(()=>expect(screen.queryByText(/The void notice has not been handed over/)).toBeNull());
    expect(screen.getByText("Recorded witness")).toBeTruthy();
    expect(screen.getByText(/Void notice copy/)).toBeTruthy();
  });
  it("shows the reminder but no handover action without Fill in", async () => {
    show(false);
    await screen.findByText(/The void notice has not been handed over/);
    expect(screen.queryByRole("button",{name:"Void notice handed to seafarer",exact:true})).toBeNull();
  });
  it("does not record a cancelled confirmation", async () => {
    Object.defineProperty(window,"confirm",{configurable:true,writable:true,value:vi.fn(()=>false)});
    show();
    fireEvent.click(await screen.findByRole("button",{name:"Void notice handed to seafarer",exact:true}));
    expect(state.post).not.toHaveBeenCalled();
  });
});
