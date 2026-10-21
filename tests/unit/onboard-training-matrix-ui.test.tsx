import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VesselTrainingMatrix } from "../../client/src/modules/vessel/components/VesselTrainingMatrix";
import { apiRequest } from "../../client/src/lib/queryClient";
vi.mock("../../client/src/lib/queryClient", () => ({ apiRequest: vi.fn() }));
const crew = () => ({
  assignmentUuid: "assignment", context: { crewUuid: "crew", crewName: "TEST ONLY Matrix", contractRankLabel: "Captured Master", vesselName: "TEST ONLY Vessel" },
  referenceKind: "on_board", joiningDate: "2026-10-21", plannedReliefDate: "2027-04-21",
  contractEnd: "2027-04-21", contractEndStatus: "set", contractEndSource: "planned_relief",
  matrixRevision: "R0", calculationVersion: "1.5.0", status: "complete", issues: [],
  courses: [{ courseUuid: "course", name: "Required A", obligation: "mandatory", state: "Not held",
    displayStatus: "Not held", complete: true, issues: [], certificates: [], chosenCertificate: null,
    futureIssuedCertificateUuids: [], category: "A. Statutory", categoryOrder: 0, matrixOrder: 0 }],
  dots: [{ courseUuid: "course", color: "red", outline: true, label: "Not held", reasons: ["Not held"] }],
  summary: { mandatory: { status: "gap", count: 1 }, recommended: { status: "valid", count: 0 } },
  unlinkedCertificateUuids: [],
});
let payload: any;
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <VesselTrainingMatrix vesselUuid="vessel" /></QueryClientProvider>);
beforeEach(() => {
  payload = { referenceDate: "2026-10-21", twoMonthDate: "2026-12-21", matrixRevision: "R0",
    rows: [{ companyTrainingId: 1, courseUuid: "course", companyId: "SA001", name: "Required A", category: "A. Statutory" }],
    crew: [crew()] };
  vi.mocked(apiRequest).mockImplementation(async () => new Response(JSON.stringify(payload)));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("server-computed onboard matrix presentation", () => {
  it("renders a dot-only empty-text cell with transparent red outline and meaning on tap", async () => {
    mount();
    const dot = await screen.findByRole("button", { name: "Not held" });
    expect(dot.textContent).toBe("");
    expect(dot.getAttribute("data-color")).toBe("red");
    expect(dot.getAttribute("data-outline")).toBe("true");
    expect(dot.querySelector("span")?.className).toContain("bg-transparent");
    expect(dot.closest("td")?.textContent).toBe("");
    fireEvent.click(dot);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Not held");
  });
  it("lists every reason on tap, not just the highest-severity one", async () => {
    payload.crew[0].dots[0] = { courseUuid: "course", color: "amber", outline: false,
      label: "Expires before planned relief", reasons: ["Expires before planned relief", "Expires within 2 months"] };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Expires before planned relief; Expires within 2 months" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Expires before planned relief; Expires within 2 months");
  });
  it("shows grey incomplete when no course calculation can be made, never a blank or green", async () => {
    payload.crew[0].status = "incomplete"; payload.crew[0].courses = []; payload.crew[0].dots = [];
    payload.crew[0].issues = [{ code: "MISSING_RANK", message: "Contract rank was not recorded at Deploy." }];
    mount();
    const dot = await screen.findByRole("button", { name: "Incomplete: Contract rank was not recorded at Deploy." });
    expect(dot.getAttribute("data-color")).toBe("grey");
  });
  it("opens the shared details with today/relief, without reliever reads or suggestion writes", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "TEST ONLY Matrix" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("21-Oct-2026")).toBeTruthy();
    expect(screen.getByText("Planned relief date")).toBeTruthy();
    expect(screen.getByText("21-Apr-2027")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("Captured Master")).toBeTruthy();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(vi.mocked(apiRequest).mock.calls[0]).toEqual(["GET", "/api/v2/vessel/vessel/training-compliance"]);
  });
  it("keeps separate columns for two crew members with the same captured rank", async () => {
    payload.crew.push({ ...crew(), assignmentUuid: "other", context: { ...crew().context, crewName: "TEST ONLY Other" } });
    mount();
    expect(await screen.findByRole("button", { name: "TEST ONLY Matrix" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "TEST ONLY Other" })).toBeTruthy();
    expect(screen.getAllByTestId("vessel-training-dot")).toHaveLength(2);
  });
  it("shows a plain failure with Retry and never raw server text", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('500 {"sql":"private details"}'));
    mount();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Onboard training compliance could not be loaded. Retry");
    expect(screen.queryByText(/private details/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByRole("button", { name: "Not held" })).toBeTruthy();
  });
});
