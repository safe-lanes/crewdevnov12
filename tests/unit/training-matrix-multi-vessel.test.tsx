import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMatrixChanges, matrixIds, readMatrixBaseline, useTrainingMatrixVessels,
} from "@/modules/admin/hooks/useTrainingMatrixVessels";

const fixture = vi.hoisted(() => ({
  api: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: fixture.api }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: fixture.toast }) }));

type Row = Record<string, any>;
let drafts: Map<string, Row>;
let revisions: Map<string, Row[]>;
let writes: Row[];
let fail: Map<string, string>;
let failLoads: Set<string>;
let deferred: Promise<void> | undefined;
const clients: QueryClient[] = [];
const key = (v: string, n: number) => `${v}-${n}`;
const revision = (v: string, n: number, ids: number[]) => ({
  vesselId: v, tmvrUuid: key(v, n), revision: `R${n}`, revisionData: { applicableTrainingIds: ids }, revisionDate: "2026-11-18",
});
function mount(selected = ["a", "b"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(({ ids }) => useTrainingMatrixVessels(ids, true), {
    wrapper, initialProps: { ids: selected },
  }), client };
}
async function start(hook: ReturnType<typeof mount>) {
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  act(() => { expect(hook.result.current.start()).toBe(true); });
}
beforeEach(() => {
  drafts = new Map();
  revisions = new Map([["a", [revision("a", 2, [1, 3])]], ["b", [revision("b", 7, [2, 4])]]]);
  writes = [];
  fail = new Map();
  failLoads = new Set();
  deferred = undefined;
  fixture.toast.mockClear();
  fixture.api.mockReset().mockImplementation(async (method: string, url: string, body?: Row) => {
    if (method === "GET") {
      const v = decodeURIComponent(url.split("/").pop()!);
      if (failLoads.has(v)) throw Error("503: Failed to load");
      let data: unknown;
      if (url.includes("drafts/by-vessel")) data = drafts.has(v) ? [drafts.get(v)] : [];
      else if (url.includes("revisions/by-vessel")) data = revisions.get(v) || [];
      else data = { nextRevision: `R${Math.max(-1, ...(revisions.get(v) || []).map(r => Number(r.revision.slice(1)))) + 1}` };
      // JSON boundary: component code cannot mutate persisted fixture data by reference.
      return { json: async () => JSON.parse(JSON.stringify(data)) };
    }
    const v = body!.vesselId;
    writes.push({ method, url, body });
    if (deferred) await deferred;
    const error = fail.get(v);
    if (error && !error.startsWith("lost")) throw Error(error);
    if (url.includes("/upsert")) drafts.set(v, { ...body, tmvdUuid: `${v}-draft`, updatedAt: Date.now().toString() });
    else {
      const old = revisions.get(v) || [];
      const n = Math.max(-1, ...old.map(r => Number(r.revision.slice(1)))) + 1;
      revisions.set(v, [...old, { ...body, tmvrUuid: key(v, n), revision: `R${n}` }]);
      drafts.delete(v);
    }
    if (error?.startsWith("lost")) {
      if (error === "lost-unreadable") failLoads.add(v);
      throw Error("Failed to fetch");
    }
    return { ok: true };
  });
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; });

describe("training matrix data compatibility", () => {
  it.each([
    [[1, 2], [1, 2]],
    ['{"applicableTrainingIds":[1,3]}', [1, 3]],
    [{ "1": "M", "3": "R", "4": true, "5": false, "6": "N" }, [1, 3, 4]],
  ])("preserves supported applicability format %j", (raw, expected) => {
    expect([...matrixIds(raw)]).toEqual(expected);
  });
  it("fails explicitly on unreadable payloads", () => {
    expect(() => matrixIds("{bad")).toThrow();
    expect(() => matrixIds({ applicableTrainingIds: "invalid" })).toThrow();
  });
  it("applies field deltas without sharing or replacing baseline sets", () => {
    const original = new Set([1, 8]);
    expect([...applyMatrixChanges(original, new Map([[1, false], [3, true]]))]).toEqual([8, 3]);
    expect([...original]).toEqual([1, 8]);
  });
  it("loads draft before latest numeric revision, including legacy JSON strings", async () => {
    revisions.set("a", [revision("a", 2, [2]), revision("a", 10, [10]), revision("a", 1, [1])]);
    expect([...(await readMatrixBaseline("a")).ids]).toEqual([10]);
    drafts.set("a", { draftData: '{"3":"M","8":"R"}' });
    expect([...(await readMatrixBaseline("a")).ids]).toEqual([3, 8]);
  });
  it("supports no history and empty drafts without falling back to an old revision", async () => {
    expect([...(await readMatrixBaseline("new")).ids]).toEqual([]);
    drafts.set("a", { draftData: [] });
    expect([...(await readMatrixBaseline("a")).ids]).toEqual([]);
  });
});

describe("per-vessel revision editing", () => {
  it("preserves different baselines, hidden rows and unselected vessels on draft save", async () => {
    const hook = mount();
    await start(hook);
    expect(hook.result.current.checkboxState(1)).toEqual({ checked: false, mixed: true });
    act(() => hook.result.current.setChecked(5, true));
    await act(() => hook.result.current.save("draft"));
    expect(drafts.get("a")!.draftData.applicableTrainingIds).toEqual([1, 3, 5]);
    expect(drafts.get("b")!.draftData.applicableTrainingIds).toEqual([2, 4, 5]);
    expect(writes.map(w => w.body.vesselId)).toEqual(["a", "b"]);
    expect(writes.every(w => Object.keys(w.body).sort().join() === "draftData,vesselId")).toBe(true);
    expect(hook.result.current.revisionMode).toBe(true);
    expect(hook.result.current.checkboxState(5)).toEqual({ checked: true, mixed: false });
  });
  it("applies common check and uncheck intent to mixed fields", async () => {
    const hook = mount();
    await start(hook);
    act(() => hook.result.current.setChecked(1, true));
    expect(hook.result.current.checkboxState(1)).toEqual({ checked: true, mixed: false });
    act(() => hook.result.current.setChecked(1, false));
    act(() => hook.result.current.setChecked(2, false));
    await act(() => hook.result.current.save("draft"));
    expect(drafts.get("a")!.draftData.applicableTrainingIds).toEqual([3]);
    expect(drafts.get("b")!.draftData.applicableTrainingIds).toEqual([4]);
  });
  it("supports reversed no-op edits and saves unchanged matrices without cross-copying", async () => {
    const hook = mount();
    await start(hook);
    act(() => hook.result.current.setChecked(9, true));
    act(() => hook.result.current.setChecked(9, false));
    await act(() => hook.result.current.save("draft"));
    expect(drafts.get("a")!.draftData.applicableTrainingIds).toEqual([1, 3]);
    expect(drafts.get("b")!.draftData.applicableTrainingIds).toEqual([2, 4]);
  });
  it("deduplicates overlapping target lists and assigns independent revisions", async () => {
    const hook = mount(["a", "b", "a"]);
    await start(hook);
    expect(hook.result.current.nextRevision).toContain("per vessel");
    act(() => hook.result.current.setChecked(5, true));
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(writes.map(w => w.body.vesselId)).toEqual(["a", "b"]);
    expect(revisions.get("a")!.at(-1)!.revision).toBe("R3");
    expect(revisions.get("b")!.at(-1)!.revision).toBe("R8");
    expect(hook.result.current.revisionMode).toBe(false);
    expect(writes.every(w => !w.url.includes("equivalents"))).toBe(true);
  });
  it("retains the single-vessel contract, cancel, draft-to-submit and date gating", async () => {
    const hook = mount(["a"]);
    await start(hook);
    act(() => hook.result.current.setChecked(1, false));
    act(() => hook.result.current.cancel());
    expect(writes).toHaveLength(0);
    await start(hook);
    await act(() => hook.result.current.save("submit", ""));
    expect(writes).toHaveLength(0);
    await act(() => hook.result.current.save("draft"));
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(writes).toHaveLength(2);
    expect(writes[1].body).toEqual({
      vesselId: "a", revisionDate: "2026-11-18", revisionData: { applicableTrainingIds: [1, 3] },
    });
    expect(drafts.has("a")).toBe(false);
  });
  it("blocks all editing and writes when any baseline fails, then recovers on retry", async () => {
    failLoads.add("b");
    const hook = mount();
    await waitFor(() => expect(hook.result.current.loadErrors).toEqual(["b"]));
    act(() => expect(hook.result.current.start()).toBe(false));
    await act(() => hook.result.current.save("draft"));
    expect(writes).toHaveLength(0);
    failLoads.clear();
    act(() => hook.result.current.retryLoads());
    await start(hook);
    expect(hook.result.current.editable).toBe(true);
  });
  it("blocks Revision until the last selected vessel's delayed baseline finishes", async () => {
    let release!: () => void;
    const delayed = new Promise<void>(resolve => { release = resolve; });
    const original = fixture.api.getMockImplementation()!;
    fixture.api.mockImplementation(async (method, url, body) => {
      if (method === "GET" && url.endsWith("/b")) await delayed;
      return original(method, url, body);
    });
    const hook = mount();
    await waitFor(() => expect(fixture.api).toHaveBeenCalledTimes(6));
    expect(hook.result.current.ready).toBe(false);
    act(() => expect(hook.result.current.start()).toBe(false));
    act(() => hook.result.current.setChecked(1, true));
    expect(writes).toHaveLength(0);
    await act(async () => { release(); });
    await start(hook);
    expect(hook.result.current.checkboxState(1).mixed).toBe(true);
  });
  it("ignores an old selection's delayed response when a different vessel is opened", async () => {
    let release!: () => void;
    const delayed = new Promise<void>(resolve => { release = resolve; });
    const original = fixture.api.getMockImplementation()!;
    fixture.api.mockImplementation(async (method, url, body) => {
      if (method === "GET" && url.endsWith("/a")) await delayed;
      return original(method, url, body);
    });
    const hook = mount(["a"]);
    hook.rerender({ ids: ["b"] });
    await start(hook);
    await act(async () => { release(); });
    expect(hook.result.current.checkboxState(1).checked).toBe(false);
    expect(hook.result.current.checkboxState(2).checked).toBe(true);
    await act(() => hook.result.current.save("draft"));
    expect(writes.map(w => w.body.vesselId)).toEqual(["b"]);
  });
  it("fails closed on malformed persisted data and never replaces it with an empty matrix", async () => {
    drafts.set("b", { draftData: "{broken" });
    const hook = mount();
    await waitFor(() => expect(hook.result.current.loadErrors).toEqual(["b"]));
    act(() => expect(hook.result.current.start()).toBe(false));
    await act(() => hook.result.current.save("draft"));
    expect(writes).toHaveLength(0);
  });
  it("does not hydrate over active edits after a background refetch", async () => {
    const hook = mount();
    await start(hook);
    act(() => hook.result.current.setChecked(5, true));
    revisions.set("a", [revision("a", 3, [90])]);
    await act(() => hook.client.invalidateQueries({ queryKey: ["tm-vessel-baseline"] }));
    expect([...hook.result.current.applicable.get("a")!]).toEqual([1, 3, 5]);
  });
  it("shows partial failures and retries only rejected targets", async () => {
    fail.set("b", "403: denied");
    const hook = mount();
    await start(hook);
    act(() => hook.result.current.setChecked(5, true));
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(hook.result.current.outcomes).toEqual([
      { vesselId: "a", outcome: "saved" }, { vesselId: "b", outcome: "failed" },
    ]);
    expect(hook.result.current.revisionMode).toBe(true);
    expect(hook.result.current.editable).toBe(false);
    await act(() => hook.result.current.save("draft"));
    expect(writes).toHaveLength(2);
    fail.clear();
    await act(() => hook.result.current.save("submit", "2026-11-19"));
    expect(writes.map(w => w.body.vesselId)).toEqual(["a", "b", "b"]);
    expect(writes.at(-1)!.body.revisionDate).toBe("2026-11-18");
    expect(revisions.get("a")).toHaveLength(2);
    expect(hook.result.current.revisionMode).toBe(false);
  });
  it("retains failed draft targets and retries them without rewriting successful drafts", async () => {
    fail.set("b", "422: invalid");
    const hook = mount();
    await start(hook);
    await act(() => hook.result.current.save("draft"));
    expect(hook.result.current.operationKind).toBe("draft");
    fail.clear();
    await act(() => hook.result.current.save("draft"));
    expect(writes.map(w => w.body.vesselId)).toEqual(["a", "b", "b"]);
    expect(hook.result.current.editable).toBe(true);
    expect(hook.result.current.operationKind).toBeUndefined();
  });
  it("does not turn committed writes into failures if the refresh API fails", async () => {
    const hook = mount(["a"]);
    await start(hook);
    const original = fixture.api.getMockImplementation()!;
    fixture.api.mockImplementation(async (method, url, body) => {
      const response = await original(method, url, body);
      if (method === "POST") failLoads.add("a");
      return response;
    });
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(hook.result.current.outcomes).toEqual([{ vesselId: "a", outcome: "saved" }]);
    expect(hook.result.current.revisionMode).toBe(false);
  });
  it.each(["draft", "submit"] as const)("reconciles a committed %s with a lost response without a second write", async kind => {
    fail.set("a", "lost");
    const hook = mount(["a"]);
    await start(hook);
    act(() => hook.result.current.setChecked(5, true));
    await act(() => hook.result.current.save(kind, "2026-11-18"));
    expect(hook.result.current.outcomes).toEqual([{ vesselId: "a", outcome: "saved" }]);
    expect(writes).toHaveLength(1);
  });
  it("blocks replay when an uncertain outcome cannot yet be verified", async () => {
    fail.set("a", "lost-unreadable");
    const hook = mount(["a"]);
    await start(hook);
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(hook.result.current.outcomes[0].outcome).toBe("uncertain");
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(writes).toHaveLength(1);
    failLoads.clear();
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(writes).toHaveLength(1);
    expect(hook.result.current.revisionMode).toBe(false);
  });
  it("keeps an ambiguous non-committed response blocked, rather than assuming retry is safe", async () => {
    fail.set("a", "503: outcome unknown");
    const hook = mount(["a"]);
    await start(hook);
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    expect(hook.result.current.outcomes[0].outcome).toBe("uncertain");
    expect(writes).toHaveLength(1);
  });
  it("prevents duplicate in-flight actions and cannot cancel a running write", async () => {
    let release!: () => void;
    deferred = new Promise(resolve => { release = resolve; });
    const hook = mount();
    await start(hook);
    let saving!: Promise<void>;
    act(() => { saving = hook.result.current.save("submit", "2026-11-18"); });
    expect(hook.result.current.busy).toBe(true);
    await act(() => hook.result.current.save("submit", "2026-11-18"));
    act(() => hook.result.current.cancel());
    expect(hook.result.current.revisionMode).toBe(true);
    await act(async () => { release(); await saving; });
    expect(writes.map(w => w.body.vesselId)).toEqual(["a", "b"]);
  });
});
