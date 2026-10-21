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
