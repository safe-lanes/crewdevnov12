import { describe, expect, it, vi } from "vitest";
import { createAwaitedPreparationDrain } from "../../scripts/test-document-preparations";

describe("test-owned Company Form document drain", () => {
  it("joins unfinished work and only resolves after all selected batches finish", async () => {
    let release!: (batch: { selected: number; ready: number; failed: number }) => void;
    const batch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
      .mockResolvedValue({ selected: 0, ready: 0, failed: 0 });
    const finish = createAwaitedPreparationDrain(batch);
    const first = finish();
    const cleanup = finish();
    expect(cleanup).toBe(first);
    let settled = false;
    void cleanup.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(batch).toHaveBeenCalledTimes(1);
    release({ selected: 1, ready: 1, failed: 0 });
    await expect(cleanup).resolves.toEqual({ selected: 1, ready: 1, failed: 0 });
    expect(batch).toHaveBeenCalledTimes(2);
    expect(settled).toBe(true);
  });

  it("propagates a drain error without retrying it", async () => {
    const failure = new Error("deliberate test drain failure");
    const batch = vi.fn().mockRejectedValue(failure);
    await expect(createAwaitedPreparationDrain(batch)()).rejects.toBe(failure);
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
