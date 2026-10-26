import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TrainingEquivalentsEditor from "@/modules/admin/TrainingEquivalentsEditor";
import { apiRequest } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));
const a = "a4900000-0000-4000-8000-000000000001";
const b = "a4900000-0000-4000-8000-000000000002";
const c = "a4900000-0000-4000-8000-000000000003";
const revision = "a4900000-0000-4000-8000-000000000010";
const draft = "a4900000-0000-4000-8000-000000000011";
const vessel = "a4900000-0000-4000-8000-000000000012";
let state: any;
function mount(editable = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><TrainingEquivalentsEditor
    vesselId={vessel} editable={editable} draftData={{ applicableTrainingIds: [101] }} /></QueryClientProvider>);
}
beforeEach(() => {
  state = { vesselId: vessel, source: { kind: "draft", uuid: draft, revision: "R1" },
    latestRevisionUuid: revision, links: [{ requiredCourseUuid: a, acceptedCourseUuid: b }],
    courses: [a, b, c].map((uuid, i) => ({ courseUuid: uuid, name: `Course ${["A", "B", "C"][i]}`, code: `T${i}` })),
    requirements: [{ companyTrainingId: 101, courseUuid: a, name: "Course A" }],
    revisions: [{ uuid: revision, revision: "R0" }] };
  vi.mocked(apiRequest).mockReset().mockImplementation(async (method, url, body: any) => {
    if (method === "PUT") state = { ...state, links: body.links };
    const result = String(url).includes("?revisionUuid=")
      ? { ...state, source: { kind: "revision", uuid: revision, revision: "R0" },
        links: [{ requiredCourseUuid: a, acceptedCourseUuid: b }] } : state;
    return new Response(JSON.stringify(result), { status: 200 });
  });
  Object.defineProperty(window, "confirm", { configurable: true, value: vi.fn(() => true) });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
describe("Training Matrix equivalent authoring", () => {
  it("saves UUID choices with current applicability and clears the dirty state", async () => {
    mount();
    fireEvent.click(await screen.findByTestId(`training-equivalents-picker-${a}`));
    fireEvent.change(screen.getByPlaceholderText("Search courses by name or code…"), { target: { value: "Course C" } });
    fireEvent.click(await screen.findByText("Course C"));
    fireEvent.click(screen.getByTestId("training-equivalents-save"));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("PUT", expect.any(String), {
      links: [{ requiredCourseUuid: a, acceptedCourseUuid: b }, { requiredCourseUuid: a, acceptedCourseUuid: c }],
      expectedDraftUuid: draft, expectedRevisionUuid: revision, draftData: { applicableTrainingIds: [101] },
    }));
    await waitFor(() => expect((screen.getByTestId("training-equivalents-save") as HTMLButtonElement).disabled).toBe(true));
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });
  it("makes an explicitly selected historical revision read-only", async () => {
    mount();
    await screen.findByTestId(`training-equivalents-picker-${a}`);
    fireEvent.change(screen.getByTestId("training-equivalents-revision-select"), { target: { value: revision } });
    await screen.findByTestId(`training-equivalents-readonly-${a}`);
    expect(screen.queryByTestId("training-equivalents-save")).toBeNull();
    expect(screen.getByText("Historical view · read-only")).toBeTruthy();
  });
  it("shows View-only users the policy without write controls", async () => {
    mount(false);
    await screen.findByTestId(`training-equivalents-readonly-${a}`);
    expect(screen.queryByTestId(`training-equivalents-picker-${a}`)).toBeNull();
    expect(screen.queryByTestId("training-equivalents-save")).toBeNull();
  });
  it("shows a plain failure and Retry, not a raw response", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('403: {"message":"You do not have permission to view this matrix."}'));
    mount();
    await screen.findByTestId("training-equivalents-error");
    expect(screen.getByText("You do not have permission to view this matrix.")).toBeTruthy();
    expect(screen.queryByText(/403:/)).toBeNull();
    expect(screen.getByTestId("training-equivalents-retry")).toBeTruthy();
  });
});
