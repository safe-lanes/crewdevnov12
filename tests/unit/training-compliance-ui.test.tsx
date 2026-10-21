import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrainingMatrixCompliance } from "../../client/src/modules/vessel/components/TrainingMatrixCompliance";
import { apiRequest } from "../../client/src/lib/queryClient";
import { calculateTrainingCompliance } from "../../server/v2/shared/training-compliance/calculator";
import { trainingComplianceCases } from "../fixtures/trainingComplianceCases";
vi.mock("../../client/src/lib/queryClient", () => ({ apiRequest: vi.fn() }));
let client: QueryClient;
function value(index: number) {
  const input = trainingComplianceCases[index].input, result = calculateTrainingCompliance(input);
  return { ...result, context: { crewUuid: "crew", crewName: "TEST ONLY Reliever",
    contractRankLabel: "Chief Officer", vesselName: "TEST ONLY Vessel" },
    courses: result.courses.map(c => ({ ...c, certificates: input.certificates
      .filter(cert => cert.certificateUuid === c.chosenCertificate?.certificateUuid)
      .map(certificate => ({ certificate, selected: true, disposition: "selected",
        isEquivalent: c.isEquivalent, flags: [], attachments: [] })) })) };
}
function mount(assignmentUuid = "synthetic-assignment") {
  return render(<QueryClientProvider client={client}><TrainingMatrixCompliance open
    planUuid="plan" assignmentUuid={assignmentUuid} /></QueryClientProvider>);
}
async function showDetails(data: ReturnType<typeof value>) {
  vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(data)));
  mount();
  fireEvent.click(await screen.findByTestId("training-compliance-see-details"));
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.mocked(apiRequest).mockReset();
});
afterEach(() => { cleanup(); client.clear(); });
describe("read-only Reliever Status training display", () => {
  it.each([0, 4, 6, 9, 10])("shows course state explicitly for review row %s", async index => {
    const data = value(index);
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(data)));
    mount();
    fireEvent.click(await screen.findByTestId("training-compliance-see-details"));
    expect(within(screen.getByTestId(`training-course-row-${data.courses[0].courseUuid}`)).getByText(data.courses[0].state!)).toBeTruthy();
    expect(screen.getByText("TEST ONLY Reliever")).toBeTruthy();
    expect(screen.getByText("Chief Officer")).toBeTruthy();
    expect(screen.getAllByText("21-Oct-2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Mandatory:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Recommended:/).length).toBeGreaterThan(0);
  });
  it("names the equivalent actually relied on", async () => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(value(1))));
    mount();
    fireEvent.click(await screen.findByTestId("training-compliance-see-details"));
    expect(screen.getByTestId(/training-selected-certificate/).textContent).toContain("Advanced fire fighting");
    expect(screen.getByText(/Equivalent/)).toBeTruthy();
  });
  it("shows every rank requirement by default, under category headings in metadata order", async () => {
    const data = value(0);
    const seed = data.courses[0];
    data.courses = [0, 1, 2, 3].map(index => ({
      ...seed,
      courseUuid: `${seed.courseUuid}-ordered-${index}`,
      name: `Requirement ${index}`,
      category: ["Safety", "Navigation", "Safety", null][index],
      categoryOrder: [2, 1, 2, null][index],
      matrixOrder: [2, 1, 1, null][index],
    }));
    await showDetails(data);
    const switchControl = screen.getByRole("switch", { name: "Show only items needing action" });
    expect(switchControl.getAttribute("aria-checked")).toBe("false");
    expect(screen.getAllByTestId(/^training-course-row-/)).toHaveLength(4);
    const categoryRows = screen.getAllByTestId(/^training-category-/);
    expect(categoryRows.map(row => row.textContent)).toEqual(["Navigation", "Safety", "Unassigned"]);
    const courseRows = screen.getAllByTestId(/^training-course-row-/);
    expect(courseRows.map(row => row.getAttribute("data-testid"))).toEqual([
      `training-course-row-${data.courses[1].courseUuid}`,
      `training-course-row-${data.courses[2].courseUuid}`,
      `training-course-row-${data.courses[0].courseUuid}`,
      `training-course-row-${data.courses[3].courseUuid}`,
    ]);
  });
  it("filters only actionable requirements and shows a composed empty-filter state", async () => {
    const data = value(0);
    data.status = "complete";
    const seed = data.courses[0];
    data.courses = [0, 1, 2].map(index => ({
      ...seed,
      courseUuid: `${seed.courseUuid}-filter-${index}`,
      name: `Filter requirement ${index}`,
      complete: true,
      state: index === 2 ? "Expires during contract" : "Valid",
      isEquivalent: index === 1,
      certificates: index === 1
        ? seed.certificates.map(entry => ({ ...entry, isEquivalent: true }))
        : [],
    }));
    await showDetails(data);
    const toggle = screen.getByRole("switch", { name: "Show only items needing action" });
    fireEvent.click(toggle);
    expect(screen.getAllByTestId(/^training-course-row-/)).toHaveLength(1);
    expect(screen.getByTestId(`training-course-row-${data.courses[2].courseUuid}`)).toBeTruthy();
    const allClearData = { ...data, courses: data.courses.map(course => ({ ...course, state: "Valid" as const })) };
    cleanup();
    await showDetails(allClearData);
    fireEvent.click(screen.getByRole("switch", { name: "Show only items needing action" }));
    expect(screen.getByText("No items needing action.")).toBeTruthy();
    expect(screen.queryAllByTestId(/^training-course-row-/)).toHaveLength(0);
  });
  it("reports no required courses only for a complete zero-count group", async () => {
    const data = value(0);
    data.status = "complete";
    data.summary.mandatory = { status: "valid", count: 0 };
    data.summary.recommended = { status: "valid", count: 0 };
    await showDetails(data);
    expect(screen.getAllByText("Mandatory: None required for this rank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recommended: None required for this rank").length).toBeGreaterThan(0);

    cleanup();
    const incomplete = { ...data, status: "incomplete" as const,
      summary: { ...data.summary, mandatory: { status: "incomplete" as const, count: 0 } } };
    await showDetails(incomplete);
    expect(screen.queryByText("Mandatory: None required for this rank")).toBeNull();
    expect(screen.getAllByText(/Mandatory: Incomplete \(0\)/).length).toBeGreaterThan(0);
  });
  it("action-only retains gaps, incomplete results and correction flags but not unflagged valid courses", async () => {
    const data = value(0), base = data.courses[0];
    data.courses = [
      { ...base, courseUuid: "clear", name: "Clear" },
      { ...base, courseUuid: "gap", name: "Gap", state: "Not held", chosenCertificate: null, certificates: [] },
      { ...base, courseUuid: "expired", name: "Expired", state: "Expired at joining" },
      { ...base, courseUuid: "unknown", name: "Unknown", state: null, complete: false },
      { ...base, courseUuid: "flag", name: "Correction", certificates: base.certificates.map(entry =>
        ({ ...entry, flags: ["Certificate dates invalid: correct the record"] })) },
    ];
    await showDetails(data);
    fireEvent.click(screen.getByRole("switch", { name: "Show only items needing action" }));
    expect(screen.queryByTestId("training-course-row-clear")).toBeNull();
    expect(screen.getAllByTestId(/^training-course-row-/).map(row => row.getAttribute("data-testid")))
      .toEqual(["training-course-row-gap", "training-course-row-expired", "training-course-row-unknown", "training-course-row-flag"]);
    fireEvent.click(screen.getByRole("switch", { name: "Show only items needing action" }));
    expect(screen.getAllByTestId(/^training-course-row-/)).toHaveLength(5);
    expect(vi.mocked(apiRequest)).toHaveBeenCalledTimes(1);
  });
  it("defaults the switch off again when details reopen and shows obligation only in its column", async () => {
    await showDetails(value(0));
    const dialog = screen.getByRole("dialog", { name: "Training Matrix Compliance" });
    expect(within(dialog).getAllByText("Mandatory", { exact: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole("switch", { name: "Show only items needing action" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close", exact: true }));
    fireEvent.click(screen.getByTestId("training-compliance-see-details"));
    expect(screen.getByRole("switch", { name: "Show only items needing action" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getAllByTestId(/^training-course-row-/)).toHaveLength(1);
  });
  it("only expands for multiple certificates, equivalents, or correction flags and does not repeat course status", async () => {
    const data = value(0);
    const plain = data.courses[0];
    const equivalent = { ...plain, courseUuid: `${plain.courseUuid}-equivalent`, name: "Equivalent certificate" };
    const flagged = { ...plain, courseUuid: `${plain.courseUuid}-flagged`, name: "Flagged certificate" };
    const notHeld = { ...plain, courseUuid: `${plain.courseUuid}-not-held`, name: "Not held requirement",
      complete: true, state: "Not held" as const, chosenCertificate: null, certificates: [] };
    const cert = plain.chosenCertificate!;
    const certificateEntry = {
      certificate: cert, isEquivalent: false, selected: true, disposition: "selected" as const,
      flags: [], attachments: [],
    };
    data.courses = [
      { ...plain, state: "Valid, no expiry", certificates: [certificateEntry] },
      { ...equivalent, state: "Valid, no expiry", isEquivalent: true,
        certificates: [{ ...certificateEntry, isEquivalent: true }] },
      { ...flagged, state: "Valid, no expiry", certificates: [{ ...certificateEntry, flags: ["Name correction required"] }] },
      { ...plain, courseUuid: `${plain.courseUuid}-multiple`, name: "Multiple certificates",
        certificates: [certificateEntry, { ...certificateEntry, certificate: { ...cert, certificateUuid: `${cert.certificateUuid}-other` }, selected: false, disposition: "not_selected" }] },
      notHeld,
    ];
    await showDetails(data);
    expect(screen.queryByTestId(`training-certificate-expand-${plain.courseUuid}`)).toBeNull();
    expect(screen.queryByTestId(`training-certificate-expand-${notHeld.courseUuid}`)).toBeNull();
    expect(screen.getByTestId(`training-certificate-expand-${equivalent.courseUuid}`)).toBeTruthy();
    expect(screen.getByTestId(`training-certificate-expand-${flagged.courseUuid}`)).toBeTruthy();
    const multipleId = `${plain.courseUuid}-multiple`;
    expect(screen.getByTestId(`training-certificate-expand-${multipleId}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId(`training-certificate-expand-${equivalent.courseUuid}`));
    expect(screen.getByText("Selected by the compliance calculation")).toBeTruthy();
    expect(screen.getAllByText("Equivalent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Valid, no expiry")).toHaveLength(3);
    fireEvent.click(screen.getByTestId(`training-certificate-expand-${flagged.courseUuid}`));
    expect(screen.getByText("Name correction required")).toBeTruthy();
  });
  it("shows missing contract end as a warning, not incomplete", async () => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(value(16))));
    mount();
    fireEvent.click(await screen.findByTestId("training-compliance-see-details"));
    expect(screen.getAllByText("Contract end not set: full-contract validity not checked").length).toBeGreaterThan(0);
    expect(screen.queryByText("Incomplete")).toBeNull();
  });
  it("shows an incomplete check and its missing fact with Retry", async () => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(value(17))));
    mount();
    fireEvent.click(await screen.findByTestId("training-compliance-see-details"));
    expect(screen.getByText(/Contract rank was not recorded at Deploy/)).toBeTruthy();
    expect(screen.getByTestId("training-compliance-recheck")).toBeTruthy();
  });
  it("never displays raw failed-request text and Retry recovers", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('500 {"sql":"private"}'))
      .mockResolvedValueOnce(new Response(JSON.stringify(value(0))));
    mount();
    fireEvent.click(await screen.findByTestId("training-compliance-retry"));
    expect(await screen.findByTestId("training-compliance-see-details")).toBeTruthy();
    expect(screen.queryByText(/private/)).toBeNull();
    expect(vi.mocked(apiRequest)).toHaveBeenCalledTimes(2);
  });
  it("does not request another assignment's facts when no link exists", async () => {
    render(<QueryClientProvider client={client}><TrainingMatrixCompliance open /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText(/linked reliever assignment is required/)).toBeTruthy());
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it("rechecks saved facts on reopen despite the application-wide infinite stale time; hides the cached result while checking", async () => {
    client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } });
    vi.mocked(apiRequest).mockResolvedValueOnce(new Response(JSON.stringify(value(0))));
    const first = mount();
    await screen.findByTestId("training-compliance-see-details");
    first.unmount();
    let finish!: (response: Response) => void;
    vi.mocked(apiRequest).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    mount();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("training-compliance-see-details")).toBeNull();
    expect(screen.getByLabelText("Loading training compliance")).toBeTruthy();
    finish(new Response(JSON.stringify(value(4))));
    fireEvent.click(await screen.findByTestId("training-compliance-see-details"));
    expect(within(screen.getByTestId(`training-course-row-${value(4).courses[0].courseUuid}`))
      .getByText(value(4).courses[0].state!)).toBeTruthy();
  });
});
