import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VesselTrainingMatrix } from "../../client/src/modules/vessel/components/VesselTrainingMatrix";
import { apiRequest } from "../../client/src/lib/queryClient";
vi.mock("../../client/src/lib/queryClient", () => ({ apiRequest: vi.fn() }));
const crew = () => ({
  assignmentUuid: "assignment", context: { crewUuid: "crew", crewName: "TEST ONLY Matrix", contractRankLabel: "Captured Master", vesselName: "TEST ONLY Vessel" },
  contractRankUuid: "captured-rank", matrixRevisionUuid: "saved-revision",
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
    expect(dot.closest("td")?.textContent).toBe("Mandatory");
    fireEvent.click(dot);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Not held");
  });
  it("lists every reason on tap, not just the highest-severity one", async () => {
    payload.crew[0].dots[0] = { courseUuid: "course", color: "amber", outline: false,
      label: "Expires before planned relief", reasons: ["Expires before planned relief", "Expires within 2 months"] };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Expires during contract; Expires within 2 months" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Expires during contract; Expires within 2 months");
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
  it("defaults to Mandatory and separates opposite obligations for the same course and rank column", async () => {
    const recommended = { ...crew(), assignmentUuid: "recommended",
      context: { ...crew().context, crewName: "TEST ONLY Recommended" },
      courses: [{ ...crew().courses[0], obligation: "recommended" }] };
    payload.crew.push(recommended);
    mount();
    await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    const mandatory = screen.getByRole("button", { name: "Mandatory", exact: true });
    const optional = screen.getByRole("button", { name: "Recommended", exact: true });
    expect(mandatory.getAttribute("aria-pressed")).toBe("true");
    expect(optional.getAttribute("aria-pressed")).toBe("false");
    const row = screen.getByText("Required A").closest("tr")!;
    let cells = within(row).getAllByRole("cell");
    expect(cells[2].textContent).toBe("Mandatory");
    expect(cells[3].textContent).toBe("RecommendedHidden by filter");
    expect(cells[3].querySelectorAll('[data-testid="vessel-training-dot"]')).toHaveLength(0);
    fireEvent.click(optional); fireEvent.click(mandatory);
    cells = within(row).getAllByRole("cell");
    expect(cells[2].textContent).toBe("MandatoryHidden by filter");
    expect(cells[3].textContent).toBe("Recommended");
    expect(cells[2].querySelectorAll('[data-testid="vessel-training-dot"]')).toHaveLength(0);
    expect(cells[3].querySelectorAll('[data-testid="vessel-training-dot"]')).toHaveLength(1);
    expect(cells[3].querySelector(".bg-blue-100")).toBeTruthy();
  });
  it("labels a known blank rank cell as not required, with no status dot", async () => {
    payload.crew.push({ ...crew(), assignmentUuid: "not-required", courses: [], dots: [],
      context: { ...crew().context, crewName: "TEST ONLY Not required" } });
    mount(); await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    const cell = within(screen.getByText("Required A").closest("tr")!).getAllByRole("cell")[3];
    expect(cell.textContent).toBe("Not required for this rank");
    expect(cell.querySelector('[data-testid="vessel-training-dot"]')).toBeNull();
  });
  it("filters whole recommended-only rows and keeps the requirement key in the evidence legend", async () => {
    payload.rows.push({ ...payload.rows[0], companyTrainingId: 2, courseUuid: "recommended-only", name: "Recommended only" });
    payload.crew[0].courses.push({ ...crew().courses[0], courseUuid: "recommended-only", name: "Recommended only", obligation: "recommended" });
    payload.crew[0].dots.push({ ...crew().dots[0], courseUuid: "recommended-only" });
    mount(); await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    expect(screen.queryByText("Recommended only")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recommended", exact: true }));
    expect(screen.getByText("Recommended only")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mandatory", exact: true }));
    expect(screen.queryByText("Required A")).toBeNull();
    const legend = screen.getByLabelText("Training compliance legend");
    expect(within(legend).getByText("Mandatory", { exact: true })).toBeTruthy();
    expect(within(legend).getByText("Recommended", { exact: true })).toBeTruthy();
    expect(within(legend).getByText("Not required for this rank", { exact: true })).toBeTruthy();
  });
  it("keeps unknown applicability visible even with both filters off, never inferring a rank from its label", async () => {
    payload.crew[0] = { ...crew(), contractRankUuid: null, status: "incomplete", courses: [], dots: [],
      issues: [{ code: "MISSING_RANK", message: "Contract rank was not recorded at Deploy." }] };
    mount();
    await screen.findByRole("button", { name: /Incomplete: Contract rank/ });
    fireEvent.click(screen.getByRole("button", { name: "Mandatory", exact: true }));
    expect(screen.getByRole("status").textContent).toContain("Choose Mandatory and/or Recommended");
    expect(screen.getByRole("button", { name: /Incomplete: Contract rank/ })).toBeTruthy();
    const cell = within(screen.getByText("Required A").closest("tr")!).getAllByRole("cell")[2];
    expect(cell.textContent).toBe("Requirement not determined");
  });
  it("does not turn known not-required cells into unknown because another course has invalid certificate dates", async () => {
    payload.crew.push({ ...crew(), assignmentUuid: "known-rank", courses: [], dots: [], status: "incomplete",
      issues: [{ code: "INVALID_CERTIFICATE_DATES", courseUuid: "different-course", message: "Correct certificate dates." }],
      context: { ...crew().context, crewName: "TEST ONLY Known rank" } });
    mount(); await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    const cell = within(screen.getByText("Required A").closest("tr")!).getAllByRole("cell")[3];
    expect(cell.textContent).toBe("Not required for this rank");
    expect(cell.querySelector('[data-testid="vessel-training-dot"]')).toBeNull();
  });
  it("distinguishes both greens and both expiry warnings in the legend and uses the existing header blue", async () => {
    mount(); await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    const legend = screen.getByLabelText("Training compliance legend");
    const classOf = (name: string) => within(legend).getByText(name, { exact: true }).querySelector("span")!.className;
    expect(classOf("Valid")).not.toBe(classOf("Valid, no expiry"));
    expect(classOf("Expires during contract")).not.toBe(classOf("Expires within 2 months"));
    expect(classOf("Valid, no expiry")).toContain("bg-[#064E3B]");
    expect(classOf("Expires within 2 months")).toContain("bg-[#FACC15]");
    expect(screen.getByRole("columnheader", { name: "Company ID" }).className).toContain("bg-[#52baf3]");
    expect(within(legend).queryByText("Expired", { exact: true })).toBeNull();
    expect(within(legend).getByText("Expired at joining", { exact: true })).toBeTruthy();
  });
  it("maps old server labels in embedded details without mutating states, issues or query cache data", async () => {
    payload.crew[0].courses[0] = { ...payload.crew[0].courses[0], state: "Expired at joining", displayStatus: "Expired" };
    payload.crew[0].dots[0] = { ...payload.crew[0].dots[0], outline: false, label: "Expired", reasons: ["Expired"] };
    const original = structuredClone(payload);
    mount(); fireEvent.click(await screen.findByRole("button", { name: "TEST ONLY Matrix" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Expired at joining", { exact: true })).toBeTruthy();
    expect(within(dialog).queryByText("Expired", { exact: true })).toBeNull();
    expect(payload).toEqual(original);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
