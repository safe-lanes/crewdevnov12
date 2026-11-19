import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppraisalForm } from "@/modules/crewing/AppraisalForm_v2";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), api: vi.fn(), close: vi.fn(), client: null as any, form: null as any, stage: null as any }));
vi.mock("@/lib/queryClient", () => ({
  get queryClient() { return mocks.client; },
  apiRequest: (...args: unknown[]) => mocks.api(...args),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/crewUser", () => ({ getCrewUserId: () => "test-user" }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ permissions: [], canView: () => true }),
}));
vi.mock("@/hooks/useVesselLookup", () => {
  const vessels: unknown[] = [];
  const getVesselId = (id: string) => id;
  return { useVesselLookup: () => ({ vessels, getVesselId }) };
});
vi.mock("@/hooks/useCompanyTrainings", () => {
  const data: unknown[] = [];
  return { useCompanyTrainings: () => ({ options: data, data, isLoading: false }) };
});
vi.mock("@/hooks/v2/useMasterDataV2", () => {
  const data: unknown[] = [];
  return {
    useAppraisalTypesV2: () => ({ data }), useUsersV2: () => ({ data }),
    useTrainingStatusOptionsV2: () => ({ data }), withLegacyStatus: (x: unknown) => x,
  };
});
// Exercise the actual form, queries, save mutations, hydration and conditional
// rendering. Child sections are small controls so unrelated catalogs stay isolated.
vi.mock("@/components/appraisal-form-parts", async () => {
  const { useWatch } = await import("react-hook-form");
  const Part = ({ form }: any) => {
    mocks.form = form;
    const name = useWatch({ control: form.control, name: "seafarersName" });
    return <label>Crew name<input aria-label="Crew name" value={name || ""}
      onChange={e => form.setValue("seafarersName", e.target.value)} /></label>;
  };
  const Empty = () => null;
  const PartF = (props: any) => { mocks.stage = props.handleStageSubmission; return null; };
  return { PartA: Part, PartB: Empty, PartC: Empty, PartD: Empty,
    PartE: Empty, PartF, PartG: Empty, RequiredMark: Empty };
});
vi.mock("@/modules/crew-pool/TrainingCourseSelectionDialog", () => ({
  TrainingCourseSelectionDialog: () => null,
}));

const crew = { id: "crew-one", name: { first: "Test", middle: "", last: "Crew" }, rank: "Master" };
const config = { formVersionId: 17, rankGroupConfig: {} };
const pinned = { ...config, formVersionUuid: "version-17", rankGroupName: "Officers" };
const saved = (extra: object = {}) => ({
  id: 42, status: "draft", formVersionId: 17, formVersionUuid: "version-17",
  appraisalData: { seafarersName: "Saved Crew", seafarersRank: "Master", trainings: [], targets: [],
    competenceAssessments: [], behaviouralAssessments: [], recommendations: [], trainingNeeds: [],
    trainingFollowups: [], officeReviews: [], appraiserComments: [], seafarerComments: [] },
  ...extra,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let configRead: ReturnType<typeof deferred<any>>;
let reads: string[];
let existing: any;
let view: ReturnType<typeof render>;
const headerSave = () => screen.getByTestId("button-save-draft-header");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  configRead = deferred();
  reads = [];
  existing = saved();
  mocks.toast.mockReset();
  mocks.close.mockReset();
  mocks.api.mockReset().mockImplementation(async (_method, _url, body) => ({
    json: async () => ({ ...existing, appraisalData: body?.appraisalData || existing.appraisalData }),
  }));
  mocks.client = new QueryClient({ defaultOptions: { queries: {
    retry: false, staleTime: Infinity,
    queryFn: async ({ queryKey }) => {
      const url = String(queryKey[0]); reads.push(url);
      if (url.includes("/form-versions/")) return configRead.promise;
      if (url.includes("/forms/for-rank/")) return config;
      if (/\/appraisals\/\d+$/.test(url)) return existing;
      return [];
    },
  } } });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { view?.unmount(); mocks.client.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function mount(id?: number, member = crew) {
  view = render(<QueryClientProvider client={mocks.client}>
    <AppraisalForm crewMember={member} appraisalId={id} onClose={mocks.close} />
  </QueryClientProvider>);
  return view;
}
async function save() {
  await screen.findByTestId("button-save-draft-header");
  fireEvent.click(headerSave());
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(reads.some(x => x.includes("/form-versions/17/"))).toBe(true));
}

describe("appraisal post-save configuration transition", () => {
  it("retains the mounted form instead of flashing a loading popup after first save", async () => {
    mount();
    const input = await screen.findByLabelText("Crew name");
    fireEvent.change(input, { target: { value: "Saved Crew" } });
    await save();
    expect(screen.queryByText("Loading form configuration")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Crew name")).toBe(input);
    expect(input).toHaveValue("Saved Crew");
    expect(screen.getByTestId("appraisal-configuration-status")).toHaveTextContent("Checking");
    expect(headerSave()).toBeDisabled();
    fireEvent.click(headerSave());
    expect(mocks.api).toHaveBeenCalledTimes(1);
    await act(async () => configRead.resolve(pinned));
    await waitFor(() => expect(headerSave()).not.toBeDisabled());
    expect(screen.getByLabelText("Crew name")).toBe(input);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft Saved" }));
  });

  it.each(["network", "malformed", "id mismatch", "uuid mismatch"])(
    "keeps a committed save distinct from a %s configuration failure", async kind => {
      mount();
      const input = await screen.findByLabelText("Crew name");
      await save();
      await act(async () => {
        if (kind === "network") configRead.reject(new Error("offline"));
        else configRead.resolve({
          ...pinned,
          ...(kind === "malformed" ? { rankGroupConfig: null } : {}),
          ...(kind === "id mismatch" ? { formVersionId: 99 } : {}),
          ...(kind === "uuid mismatch" ? { formVersionUuid: "wrong-version" } : {}),
        });
      });
      await waitFor(() => expect(screen.getByTestId("appraisal-configuration-status"))
        .toHaveTextContent("was saved, but"));
      expect(screen.getByLabelText("Crew name")).toBe(input);
      expect(screen.getByTestId("appraisal-configuration-status")).toHaveAttribute("role", "alert");
      expect(headerSave()).toBeDisabled();
      fireEvent.click(headerSave());
      fireEvent.click(screen.getByTestId("button-submit-stage1"));
      expect(mocks.api).toHaveBeenCalledTimes(1);
      expect(mocks.toast.mock.calls.filter(([x]) => x.title === "Draft Saved")).toHaveLength(1);
      expect(mocks.toast.mock.calls.some(([x]) => x.variant === "destructive")).toBe(false);
      fireEvent.click(screen.getByLabelText("Close appraisal"));
      expect(mocks.close).toHaveBeenCalledTimes(1);
    });

  it("does not replace initial loading with an unverified editable form", async () => {
    mount(42);
    expect(await screen.findByText("Loading form configuration")).toBeVisible();
    expect(screen.queryByLabelText("Crew name")).not.toBeInTheDocument();
    await act(async () => configRead.resolve(pinned));
    await screen.findByLabelText("Crew name");
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("still blocks initial configuration failures", async () => {
    mount(42);
    await waitFor(() => expect(reads.some(x => x.includes("/form-versions/17/"))).toBe(true));
    await act(async () => configRead.reject(new Error("offline")));
    expect(await screen.findByText("Form configuration unavailable")).toBeVisible();
    expect(screen.queryByLabelText("Crew name")).not.toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("saves an already pinned appraisal without a new loading transition", async () => {
    configRead.resolve(pinned);
    mount(42);
    const input = await screen.findByLabelText("Crew name");
    fireEvent.change(input, { target: { value: "Edited Crew" } });
    fireEvent.click(headerSave());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft Saved" })));
    expect(screen.getByLabelText("Crew name")).toBe(input);
    expect(input).toHaveValue("Edited Crew");
    expect(reads.filter(x => x.includes("/form-versions/"))).toHaveLength(1);
    expect(mocks.api).toHaveBeenCalledWith("PUT", "/api/v2/appraisals/42",
      expect.objectContaining({ expectedFormVersionId: 17, status: "draft" }));
  });

  it("handles an unpinned existing draft becoming pinned on save", async () => {
    mocks.client.setQueryData(["/api/v2/appraisals/42"], saved({ formVersionId: null, formVersionUuid: null }));
    mount(42);
    const input = await screen.findByLabelText("Crew name");
    await save();
    expect(screen.queryByText("Loading form configuration")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Crew name")).toBe(input);
    expect(headerSave()).toBeDisabled();
    await act(async () => configRead.resolve(pinned));
    await waitFor(() => expect(headerSave()).not.toBeDisabled());
    expect(mocks.api.mock.calls[0][0]).toBe("PUT");
  });

  it("does not flash for a warm pinned configuration cache", async () => {
    mocks.client.setQueryData(["/api/v2/admin/form-versions/17/configuration"], pinned);
    mount();
    const input = await screen.findByLabelText("Crew name");
    fireEvent.click(headerSave());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.queryByText("Loading form configuration")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Crew name")).toBe(input);
    expect(headerSave()).not.toBeDisabled();
  });

  it("prevents double-click saves even before mutation state rerenders", async () => {
    const post = deferred<any>();
    mocks.api.mockImplementation(() => post.promise);
    mount();
    await screen.findByLabelText("Crew name");
    act(() => { headerSave().click(); headerSave().click(); });
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
    expect(headerSave()).toBeDisabled();
    await act(async () => post.resolve({ json: async () => existing }));
    await act(async () => configRead.resolve(pinned));
    await waitFor(() => expect(headerSave()).not.toBeDisabled());
  });

  it("keeps comments, active section, and the scroll container during resolution", async () => {
    mount();
    await screen.findByLabelText("Crew name");
    act(() => mocks.form.setValue("appraiserComments", [
      { id: "primary", name: "Appraiser", rank: "Master", comment: "Keep this comment" },
    ]));
    const container = screen.getByTestId("container-continuous-ab");
    container.scrollTop = 180;
    const nav = screen.getAllByTestId("button-step-B")[0];
    fireEvent.click(nav);
    await save();
    expect(screen.getByTestId("container-continuous-ab")).toBe(container);
    expect(container.scrollTop).toBe(180);
    expect(nav).toHaveAttribute("aria-current", "step");
    await act(async () => configRead.resolve(pinned));
    await waitFor(() => expect(headerSave()).not.toBeDisabled());
    expect(screen.getByTestId("container-continuous-ab")).toBe(container);
    expect(mocks.form.getValues("appraiserComments")[0].comment).toBe("Keep this comment");
    expect(nav).toHaveAttribute("aria-current", "step");
  });

  it("does not retain another crew's form while its configuration loads", async () => {
    mount();
    await save();
    view.rerender(<QueryClientProvider client={mocks.client}>
      <AppraisalForm crewMember={{ ...crew, id: "other-crew" }} appraisalId={77} onClose={mocks.close} />
    </QueryClientProvider>);
    expect(await screen.findByText("Loading form configuration")).toBeVisible();
    expect(screen.queryByLabelText("Crew name")).not.toBeInTheDocument();
    await act(async () => configRead.resolve(pinned));
    await screen.findByLabelText("Crew name");
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it("can close during pending resolution without replaying a save", async () => {
    mount();
    await save();
    fireEvent.click(screen.getByLabelText("Close appraisal"));
    expect(mocks.close).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => configRead.resolve(pinned));
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it("keeps existing stage validation and confirmation before writes", async () => {
    mount();
    await screen.findByLabelText("Crew name");
    fireEvent.click(screen.getByTestId("button-submit-stage1"));
    expect(await screen.findByRole("alertdialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Yes", exact: true }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Validation Error" })));
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("preserves reviewed status and locked header controls", async () => {
    existing = saved({ status: "reviewed", isLockForm: true });
    configRead.resolve(pinned);
    mount(42);
    await screen.findByLabelText("Crew name");
    expect(headerSave()).toBeDisabled();
    fireEvent.click(headerSave());
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("keeps a save failure retryable without claiming that it succeeded", async () => {
    mocks.api.mockRejectedValueOnce(new Error("fixture save failure"));
    mount();
    const input = await screen.findByLabelText("Crew name");
    fireEvent.click(headerSave());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error", variant: "destructive" })));
    expect(headerSave()).not.toBeDisabled();
    expect(screen.getByLabelText("Crew name")).toBe(input);
    expect(reads.some(x => x.includes("/form-versions/"))).toBe(false);
    fireEvent.click(headerSave());
    await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
    await act(async () => configRead.resolve(pinned));
    await waitFor(() => expect(headerSave()).not.toBeDisabled());
  });

  it("keeps the same snapshot display-only if the saved version differs", async () => {
    existing = saved({ formVersionId: 18, formVersionUuid: "version-18" });
    mount();
    await screen.findByLabelText("Crew name");
    fireEvent.click(headerSave());
    await waitFor(() => expect(reads.some(x => x.includes("/form-versions/18/"))).toBe(true));
    expect(headerSave()).toBeDisabled();
    // A response for the original version must not satisfy the new saved pin.
    await act(async () => configRead.resolve(pinned));
    await waitFor(() => expect(screen.getByTestId("appraisal-configuration-status")).toHaveAttribute("role", "alert"));
    fireEvent.click(headerSave());
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it("continues first Stage 1 submission using the configuration validated before its internal draft save", async () => {
    mount();
    await screen.findByLabelText("Crew name");
    act(() => {
      mocks.form.setValue("vessel", "vessel-one");
      mocks.form.setValue("appraisalType", "Annual");
      mocks.form.setValue("appraisalPeriodTo", "2026-11-01");
    });
    fireEvent.click(screen.getByTestId("button-submit-stage1"));
    fireEvent.click(await screen.findByRole("button", { name: "Yes", exact: true }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
    expect(mocks.api.mock.calls.map(x => [x[0], x[1]])).toEqual([
      ["POST", "/api/v2/appraisals"], ["POST", "/api/v2/appraisals/42/submit-stage1"],
    ]);
    expect(mocks.api.mock.calls.every(x => x[2].expectedFormVersionId === 17)).toBe(true);
    expect(mocks.toast.mock.calls.some(([x]) => x.title === "Draft Saved")).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Stage 1 Submitted" }));
  });

  it.each([
    ["stage2", "preliminary", "Submitted for Review"],
    ["stage3", "pending_review", "Stage 3 Submitted"],
  ])("keeps %s submission and close behavior unchanged", async (stage, status, title) => {
    existing = saved({ status });
    configRead.resolve(pinned);
    mount(42);
    await screen.findByLabelText("Crew name");
    fireEvent.click(screen.getAllByTestId("button-step-F")[0]);
    expect(mocks.stage).toBeTypeOf("function");
    await act(async () => mocks.stage(stage));
    fireEvent.click(await screen.findByRole("button", { name: "Yes", exact: true }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledTimes(1));
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(mocks.api).toHaveBeenCalledWith("POST", `/api/v2/appraisals/42/submit-${stage}`,
      expect.objectContaining({ expectedFormVersionId: 17 }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title }));
  });
});
