import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnBoardStatusEditDialog_v2 } from "../../../../client/src/modules/vessel/components/OnBoardStatusEditDialog_v2";

const mocks = vi.hoisted(() => ({
    update: { mutateAsync: vi.fn() },
    create: { mutateAsync: vi.fn() },
    planning: vi.fn().mockResolvedValue([]),
    request: vi.fn().mockResolvedValue({}),
    toast: vi.fn(),
    queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: null }),
    useQueryClient: () => mocks.queryClient,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useVesselLookup", () => ({ useVesselLookup: () => ({ getVesselName: () => "Test Vessel" }) }));
vi.mock("../../../../client/src/modules/vessel/hooks/useVesselV2", () => ({
    useUpdatePlanningV2: () => mocks.update,
    useCreatePlanningV2: () => mocks.create,
    useVesselPlanningV2: () => ({ data: [] }),
}));
vi.mock("../../../../client/src/modules/vessel/api/vesselApiV2", () => ({
    vesselApiV2: { getVesselPlanning: mocks.planning },
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.request }));
vi.mock("@/components/ui/SearchablePortCombobox", () => ({
    SearchablePortCombobox: () => <span>Port selector</span>,
}));
vi.mock("@/components/ui/tooltip", () => ({
    Tooltip: ({ children }: any) => <>{children}</>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,
    TooltipContent: () => null,
}));

const base = {
    planUuid: "plan-test", crewUuid: "crew-test", crewStatus: "primary",
    onBoardCrewName: "Test Crew", signOnDate: "2025-01-10",
    signOffDate: "2025-04-22", reliefStatus: "On Board",
    signOffReason: "Contract Completed", signOffPortUuid: "port-test",
};
const props = {
    open: true, onOpenChange: vi.fn(), rank: "Master",
    rankId: "rank-test", vesselUuid: "vessel-test",
};
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("onboard duration in the real dialog", () => {
    it("updates after manual date input and never saves on editing", async () => {
        render(<OnBoardStatusEditDialog_v2 {...props} planningData={base} />);
        expect(screen.getByTestId("text-onboard-duration")).toHaveTextContent("Onboard: 3 months, 12 days.");
        const input = screen.getByTestId("input-signOffDate-manual");
        fireEvent.change(input, { target: { value: "11-Feb-2025" } });
        fireEvent.blur(input);
        await waitFor(() => expect(screen.getByTestId("text-onboard-duration")).toHaveTextContent("Onboard: 1 month, 1 day."));
        expect(mocks.request).not.toHaveBeenCalled();
        expect(mocks.update.mutateAsync).not.toHaveBeenCalled();
        expect(mocks.planning).not.toHaveBeenCalled();
        expect(screen.queryByRole("textbox", { name: /duration/i })).not.toBeInTheDocument();
    });

    it("resets for another crew and when reopened without planning data", () => {
        const { rerender } = render(<OnBoardStatusEditDialog_v2 {...props} planningData={base} />);
        rerender(<OnBoardStatusEditDialog_v2 {...props} planningData={{
            ...base, crewUuid: "crew-two", signOnDate: "2025-04-22",
        }} />);
        expect(screen.getByTestId("text-onboard-duration")).toHaveTextContent("Onboard: 0 months, 0 days.");
        rerender(<OnBoardStatusEditDialog_v2 {...props} open={false} planningData={base} />);
        rerender(<OnBoardStatusEditDialog_v2 {...props} planningData={{ ...base, signOnDate: "" }} />);
        expect(screen.getByTestId("text-onboard-duration")).toHaveTextContent("Onboard duration unavailable.");
        rerender(<OnBoardStatusEditDialog_v2 {...props} planningData={undefined} />);
        expect(screen.getByTestId("text-onboard-duration")).toHaveTextContent("Onboard duration unavailable.");
    });

    it("preserves the exact sign-off request without sending duration", async () => {
        render(<OnBoardStatusEditDialog_v2 {...props} planningData={{ ...base, reliefStatus: "Signed Off" }} />);
        fireEvent.click(screen.getByTestId("button-submit-onboard"));
        await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
        expect(mocks.request).toHaveBeenCalledWith(
            "POST", "/api/v2/vessel/planning/plan-test/sign-off",
            { signOffDate: "2025-04-22", signOffReason: "Contract Completed", signOffPortUuid: "port-test", travelEndDate: undefined },
        );
        expect(mocks.update.mutateAsync).not.toHaveBeenCalled();
        expect(mocks.create.mutateAsync).not.toHaveBeenCalled();
    });

    it("preserves existing regular update payload keys", async () => {
        render(<OnBoardStatusEditDialog_v2 {...props} planningData={base} />);
        fireEvent.click(screen.getByTestId("button-submit-onboard"));
        await waitFor(() => expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(1));
        expect(mocks.update.mutateAsync.mock.calls[0][0]).toEqual({
            planUuid: "plan-test",
            data: {
                reliefDue: "", signOffDate: "2025-04-22", signOffPortUuid: "port-test",
                signOffReason: "Contract Completed", reliefStatus: "On Board",
                takeOverDate: "", takeOverConfirmation: false, contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined, contractEndRangeEndMonths: undefined,
            },
        });
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it("keeps sign-off reason validation and future-date clearing", async () => {
        const future = `${new Date().getFullYear() + 1}-04-22`;
        const { rerender } = render(<OnBoardStatusEditDialog_v2 {...props} planningData={{
            ...base, reliefStatus: "Signed Off", signOffReason: "",
        }} />);
        fireEvent.click(screen.getByTestId("button-submit-onboard"));
        await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive", description: expect.stringContaining("valid Reason"),
        })));
        expect(mocks.request).not.toHaveBeenCalled();
        // Transition status as in the existing UI, which clears a future date.
        rerender(<OnBoardStatusEditDialog_v2 {...props} planningData={{ ...base, signOffDate: future }} />);
        rerender(<OnBoardStatusEditDialog_v2 {...props} planningData={{ ...base, signOffDate: future, reliefStatus: "Signed Off" }} />);
        await waitFor(() => expect(screen.getByTestId("text-onboard-duration")).toHaveTextContent("Onboard duration unavailable."));
    });
});
