import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VesselTrainingMatrix } from "../../client/src/modules/vessel/components/VesselTrainingMatrix";
import { apiRequest } from "../../client/src/lib/queryClient";

vi.mock("../../client/src/lib/queryClient", () => ({ apiRequest: vi.fn() }));

const crew = () => ({
  assignmentUuid: "assignment",
  context: { crewUuid: "crew", crewName: "TEST ONLY Matrix", contractRankLabel: "Captured Master", vesselName: "TEST ONLY Vessel" },
  contractRankUuid: "captured-rank",
  matrixRevisionUuid: "saved-revision",
  referenceKind: "on_board",
  joiningDate: "2026-10-21",
  plannedReliefDate: "2027-04-21",
  contractEnd: "2027-04-21",
  contractEndStatus: "set",
  contractEndSource: "planned_relief",
  matrixRevision: "R0",
  calculationVersion: "1.5.0",
  status: "complete",
  issues: [],
  courses: [{
    courseUuid: "course",
    name: "Required A",
    obligation: "mandatory",
    state: "Not held",
    displayStatus: "Not held",
    complete: true,
    issues: [],
    certificates: [],
    chosenCertificate: null,
    futureIssuedCertificateUuids: [],
    category: "A. Statutory",
    categoryOrder: 0,
    matrixOrder: 0,
  }],
  dots: [{ courseUuid: "course", color: "red", outline: true, label: "Not held", reasons: ["Not held"] }],
  summary: { mandatory: { status: "gap", count: 1 }, recommended: { status: "valid", count: 0 } },
  unlinkedCertificateUuids: [],
});

let payload: any;
const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <VesselTrainingMatrix vesselUuid="vessel" />
  </QueryClientProvider>,
);

const matrixRow = () => screen.getByText("Required A").closest("tr")!;
const matrixCell = (index: number) => within(matrixRow()).getAllByRole("cell")[index];

beforeEach(() => {
  payload = {
    referenceDate: "2026-10-21",
    twoMonthDate: "2026-12-21",
    matrixRevision: "R0",
    rows: [{ companyTrainingId: 1, courseUuid: "course", companyId: "SA001", name: "Required A", category: "A. Statutory" }],
    crew: [crew()],
  };
  vi.mocked(apiRequest).mockImplementation(async () => new Response(JSON.stringify(payload)));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("server-computed onboard matrix presentation", () => {
  it("renders one compact hollow red dot, with requirement and full state on tap", async () => {
    mount();
    const dot = await screen.findByRole("button", { name: "Mandatory — Not held" });
    expect(dot.textContent).toBe("");
    expect(dot.getAttribute("data-color")).toBe("red");
    expect(dot.getAttribute("data-outline")).toBe("true");
    expect(dot.querySelector("span")?.className).toContain("border-[#DC2626]");
    expect(dot.querySelector("span")?.className).toContain("bg-transparent");
    expect(matrixCell(2).textContent).toBe("");
    fireEvent.click(dot);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Mandatory — Not held");
  });

  it("keeps all applicable non-retired reasons and applies red-filled precedence", async () => {
    payload.crew[0].courses[0] = {
      ...payload.crew[0].courses[0],
      state: "Expired at joining",
      issues: [{ message: "Certificate was expired at joining." }],
    };
    payload.crew[0].dots[0] = {
      courseUuid: "course",
      color: "amber",
      outline: false,
      label: "Expires before planned relief",
      reasons: ["Expires before planned relief", "Expires within 2 months"],
    };
    mount();
    const dot = await screen.findByRole("button", { name: /Mandatory — Expired at joining/ });
    expect(dot.getAttribute("data-color")).toBe("red");
    expect(dot.getAttribute("data-outline")).toBe("false");
    fireEvent.click(dot);
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Expires during contract");
    expect(status.textContent).toContain("Certificate was expired at joining.");
    expect(status.textContent).not.toContain("Expires within 2 months");
  });

  it("applies red-hollow precedence over contract expiry and incomplete evidence", async () => {
    payload.crew[0].courses[0] = {
      ...payload.crew[0].courses[0],
      state: "Incomplete",
      complete: false,
      issues: [{ message: "Certificate scan is unreadable." }],
    };
    payload.crew[0].dots[0] = {
      courseUuid: "course",
      color: "amber",
      outline: false,
      label: "Multiple evidence conditions",
      reasons: ["Not held", "Expires before planned relief", "Expiry not recorded"],
    };
    mount();
    const dot = await screen.findByRole("button", { name: /Mandatory —/ });
    expect(dot.getAttribute("data-color")).toBe("red");
    expect(dot.getAttribute("data-outline")).toBe("true");
    fireEvent.click(dot);
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Not held");
    expect(status.textContent).toContain("Expires during contract");
    expect(status.textContent).toContain("Expiry not recorded");
    expect(status.textContent).toContain("Certificate scan is unreadable.");
  });

  it("applies amber-filled precedence over expiry-not-recorded and incomplete", async () => {
    payload.crew[0].courses[0] = {
      ...payload.crew[0].courses[0],
      state: "Incomplete",
      displayStatus: "Incomplete",
      complete: false,
      issues: [{ message: "Certificate details are incomplete." }],
    };
    payload.crew[0].dots[0] = {
      courseUuid: "course",
      color: "amber",
      outline: true,
      label: "Expires before planned relief",
      reasons: ["Expires before planned relief", "Expiry not recorded"],
    };
    mount();
    const dot = await screen.findByRole("button", { name: /Mandatory —/ });
    expect(dot.getAttribute("data-color")).toBe("amber");
    expect(dot.getAttribute("data-outline")).toBe("false");
    expect(dot.querySelector("span")?.className).toContain("bg-[#F59E0B]");
  });

  it("uses canonical Valid for a two-month-only amber raw dot and hides the retired label", async () => {
    payload.crew[0].courses[0] = {
      ...payload.crew[0].courses[0],
      state: "Valid",
      displayStatus: "Valid",
      complete: true,
    };
    payload.crew[0].dots[0] = {
      courseUuid: "course",
      color: "amber",
      outline: true,
      label: "Expires within 2 months",
      reasons: ["Expires within 2 months"],
    };
    mount();
    const dot = await screen.findByRole("button", { name: "Mandatory — Valid" });
    expect(dot.getAttribute("data-color")).toBe("green");
    expect(dot.querySelector("span")?.className).toContain("bg-[#16A34A]");
    expect(screen.queryByText(/Expires within 2 months/)).toBeNull();
  });

  it("renders both valid states as the same exact green", async () => {
    payload.crew[0].courses[0] = {
      ...payload.crew[0].courses[0],
      state: "Valid, no expiry",
      displayStatus: "Valid, no expiry",
      complete: true,
    };
    payload.crew[0].dots[0] = {
      courseUuid: "course",
      color: "green",
      outline: false,
      label: "Valid, no expiry",
      reasons: ["Valid, no expiry"],
    };
    mount();
    const dot = await screen.findByRole("button", { name: "Mandatory — Valid, no expiry" });
    expect(dot.getAttribute("data-color")).toBe("green");
    expect(dot.querySelector("span")?.className).toContain("border-[#16A34A]");
    expect(dot.querySelector("span")?.className).toContain("bg-[#16A34A]");
  });

  it("maps incomplete evidence to hollow amber, never green, while retaining its specific reason", async () => {
    payload.crew[0].courses[0] = {
      ...payload.crew[0].courses[0],
      state: "Incomplete",
      displayStatus: "Incomplete",
      complete: false,
      issues: [{ message: "Certificate dates are incomplete." }],
    };
    payload.crew[0].dots[0] = {
      courseUuid: "course",
      color: "grey",
      outline: false,
      label: "Incomplete",
      reasons: ["Incomplete"],
    };
    mount();
    const dot = await screen.findByRole("button", { name: /Mandatory — Incomplete/ });
    expect(dot.getAttribute("data-color")).toBe("amber");
    expect(dot.getAttribute("data-outline")).toBe("true");
    expect(dot.querySelector("span")?.className).toContain("border-[#F59E0B]");
    expect(dot.querySelector("span")?.className).toContain("bg-transparent");
    fireEvent.click(dot);
    expect((await screen.findByRole("status")).textContent).toContain("Certificate dates are incomplete.");
  });

  it("opens the approved shared details with dates, without reliever reads or suggestion writes", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "TEST ONLY Matrix" }));
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
    expect(await screen.findByRole("button", { name: "Mandatory — Not held" })).toBeTruthy();
  });

  it("defaults to Mandatory and leaves opposite-requirement cells blank when filtered out", async () => {
    const recommended = {
      ...crew(),
      assignmentUuid: "recommended",
      context: { ...crew().context, crewName: "TEST ONLY Recommended" },
      courses: [{ ...crew().courses[0], obligation: "recommended" }],
    };
    payload.crew.push(recommended);
    mount();
    await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    const mandatory = screen.getByRole("button", { name: "Mandatory", exact: true });
    const optional = screen.getByRole("button", { name: "Recommended", exact: true });
    expect(mandatory.getAttribute("aria-pressed")).toBe("true");
    expect(optional.getAttribute("aria-pressed")).toBe("false");
    expect(matrixCell(2).textContent).toBe("");
    expect(matrixCell(3).textContent).toBe("");
    expect(matrixCell(3).querySelectorAll('[data-testid="vessel-training-dot"]')).toHaveLength(0);
    expect(matrixCell(3).querySelector('[data-testid="vessel-training-cell-info"]')).toBeTruthy();
    fireEvent.click(optional);
    expect(matrixCell(3).querySelectorAll('[data-testid="vessel-training-dot"]')).toHaveLength(1);
    expect(matrixCell(3).firstElementChild?.className).toContain("bg-blue-100");
  });

  it("renders unknown or absent requirement as a blank non-required cell without a dot", async () => {
    payload.crew.push({
      ...crew(),
      assignmentUuid: "not-required",
      courses: [],
      dots: [{ courseUuid: "course", color: "red", outline: true, label: "Stale evidence", reasons: ["Stale dot reason"] }],
      context: { ...crew().context, crewName: "TEST ONLY Not required" },
    });
    mount();
    await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    expect(matrixCell(3).textContent).toBe("");
    expect(matrixCell(3).querySelector('[data-testid="vessel-training-dot"]')).toBeNull();
    const trigger = matrixCell(3).querySelector('[data-testid="vessel-training-cell-info"]')!;
    expect(trigger.getAttribute("aria-label")).toBe("Not required for this rank");
    fireEvent.click(trigger);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Not required for this rank");
    expect(screen.queryByText(/Stale dot reason/)).toBeNull();
  });

  it("keeps the compact legend to the exact two requirement filters and five evidence captions", async () => {
    mount();
    await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    const legend = screen.getByLabelText("Training compliance legend");
    for (const label of ["Requirement:", "Mandatory", "Recommended", "Evidence:", "Valid",
      "Expires during contract", "Expired at joining", "Not held", "Expiry not recorded"]) {
      expect(within(legend).getByText(label, { exact: true })).toBeTruthy();
    }
    for (const retired of ["Not required for this rank", "Requirement not determined", "Expires within 2 months", "Incomplete"]) {
      expect(within(legend).queryByText(retired, { exact: true })).toBeNull();
    }
    expect(within(legend).getAllByText(/^(Valid|Expires during contract|Expired at joining|Not held|Expiry not recorded)$/)).toHaveLength(5);
    expect(screen.getByRole("columnheader", { name: /Captured master/ }).className).toContain("bg-[#52baf3]");
  });

  it("uses sentence-case rank-first headers and truncates the crew name while preserving its full title", async () => {
    const longCrewName = "TEST ONLY MARINER WITH AN EXCEPTIONALLY LONG RECORDED NAME";
    payload.crew[0].context = { ...payload.crew[0].context, crewName: longCrewName, contractRankLabel: "CHIEF OFFICER" };
    mount();
    const header = await screen.findByRole("columnheader", { name: /Chief officer/ });
    const children = Array.from(header.children);
    expect(children[0].textContent).toBe("Chief officer");
    expect(children[0].className).not.toContain("uppercase");
    const name = within(header).getByRole("button", { name: longCrewName });
    expect(name.title).toBe(longCrewName);
    expect(name.textContent?.trim()).toBe("Test only mariner with an exceptionally long recorded name");
    expect(name.className).toContain("truncate");
    expect(header.className).toContain("min-w-[142px]");
  });
  it("sentence-cases mixed-case visible headings without changing identity or approved popup data", async () => {
    payload.crew[0].context = { ...payload.crew[0].context,
      crewName: "Test ONLY Mariner", contractRankLabel: "Chief Officer" };
    mount();
    const header = await screen.findByRole("columnheader", { name: /Chief officer/ });
    const name = within(header).getByRole("button", { name: "Test ONLY Mariner" });
    expect(name.textContent?.trim()).toBe("Test only mariner");
    expect(name.title).toBe("Test ONLY Mariner");
    fireEvent.click(name);
    expect(within(await screen.findByRole("dialog")).getByText("Chief Officer")).toBeTruthy();
    expect(payload.crew[0].context.crewName).toBe("Test ONLY Mariner");
  });
  it("never shows green for an incomplete overall check even if its dot metadata is absent", async () => {
    payload.crew[0].status = "incomplete";
    payload.crew[0].issues = [{ code: "CALCULATION_FAILED", message: "Another required course could not be checked." }];
    payload.crew[0].courses[0] = { ...payload.crew[0].courses[0], state: "Valid", displayStatus: "Valid" };
    payload.crew[0].dots = [];
    mount();
    const dot = await screen.findByTestId("vessel-training-dot");
    expect(dot.getAttribute("data-color")).toBe("amber");
    expect(dot.getAttribute("data-outline")).toBe("true");
    expect(dot.getAttribute("aria-label")).toContain("Another required course could not be checked.");
  });

  it("filters whole rows by requirement and preserves the embedded details transformation without mutating query data", async () => {
    payload.rows.push({ ...payload.rows[0], companyTrainingId: 2, courseUuid: "recommended-only", name: "Recommended only" });
    payload.crew[0].courses.push({
      ...crew().courses[0],
      courseUuid: "recommended-only",
      name: "Recommended only",
      obligation: "recommended",
      state: "Expired at joining",
      displayStatus: "Expired",
    });
    payload.crew[0].dots.push({
      ...crew().dots[0],
      courseUuid: "recommended-only",
      outline: false,
      label: "Expired",
      reasons: ["Expired"],
    });
    const original = structuredClone(payload);
    mount();
    await screen.findByRole("button", { name: "TEST ONLY Matrix" });
    expect(screen.queryByText("Recommended only")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recommended", exact: true }));
    expect(screen.getByText("Recommended only")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mandatory", exact: true }));
    expect(screen.queryByText("Required A")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "TEST ONLY Matrix" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Expired at joining", { exact: true })).toBeTruthy();
    expect(within(dialog).queryByText("Expired", { exact: true })).toBeNull();
    expect(payload).toEqual(original);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
