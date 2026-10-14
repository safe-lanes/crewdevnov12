import { describe, it, expect, vi } from "vitest";

const api = vi.hoisted(() => ({ createPlanning: vi.fn(), updatePlanning: vi.fn() }));
vi.mock("../../client/src/modules/vessel/api/vesselApiV2", () => ({ vesselApiV2: api }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: any) => options,
}));
import { useCreatePlanningV2, useUpdatePlanningV2 } from "../../client/src/modules/vessel/hooks/useVesselV2";

describe("Company Forms checklist Planning requests", () => {
  it("does not manufacture browser audit identity on an update", async () => {
    const data = { deploymentChecklistCompleted: true, checklistOverride: { reason: "Verified pending facts" } };
    await (useUpdatePlanningV2() as any).mutationFn({ planUuid: "exact-plan", data });
    expect(api.updatePlanning).toHaveBeenCalledWith("exact-plan", data);
    expect(api.updatePlanning.mock.calls.at(-1)?.[1]).not.toHaveProperty("auditUserUuid");
  });
  it("leaves creation audit identity to the server too", async () => {
    const data = { vesselUuid: "fixture-vessel", rankId: "fixture-rank", deploymentChecklistCompleted: false };
    await (useCreatePlanningV2() as any).mutationFn(data);
    expect(api.createPlanning).toHaveBeenCalledWith(data);
    expect(api.createPlanning.mock.calls.at(-1)?.[0]).not.toHaveProperty("auditUserUuid");
  });
});
