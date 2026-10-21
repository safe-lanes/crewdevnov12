import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrainingNeedSuggestion, type TrainingSuggestion } from "../../client/src/modules/vessel/components/TrainingNeedSuggestion";
import { apiRequest } from "../../client/src/lib/queryClient";
vi.mock("../../client/src/lib/queryClient", () => ({ apiRequest: vi.fn() }));
const suggestion: TrainingSuggestion = { suggestion_uuid: "suggestion", course_uuid: "course",
  status: "SUGGESTED", target_date: "2027-02-28", confirmed_at: null,
  closed_certificate_uuid: null, gap: {} };
let client: QueryClient;
function mount(value = suggestion, canCreate = true) {
  const onSaved = vi.fn();
  render(<QueryClientProvider client={client}><TrainingNeedSuggestion suggestion={value}
    canCreate={canCreate} suggestionQueryKey={["suggestions"]} onSaved={onSaved} /></QueryClientProvider>);
  return onSaved;
}
beforeEach(() => { client = new QueryClient({ defaultOptions: { mutations: { retry: false } } }); vi.mocked(apiRequest).mockReset(); });
afterEach(() => { cleanup(); client.clear(); });
describe("training suggestion actions", () => {
  it("shows source and a SAIL target strictly before expiry", () => {
    mount(); expect(screen.getByText("Target 28-Feb-2027")).toBeTruthy();
    expect(screen.getByText("Pre-joining compliance")).toBeTruthy();
  });
  it("hides both actions without the create right", () => {
    mount(suggestion, false);
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });
  it("confirms with an empty body, never a browser identity", async () => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify({ ...suggestion, status: "CONFIRMED" })));
    const saved = mount();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/v2/training-needs/compliance/suggestion/confirm", {});
  });
  it("requires a written reason in its dismiss window", async () => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify({ ...suggestion, status: "DISMISSED" })));
    const saved = mount();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const confirm = screen.getByRole("button", { name: "Dismiss suggestion" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  Course booked separately  " } });
    fireEvent.click(confirm);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/v2/training-needs/compliance/suggestion/dismiss",
      { reason: "Course booked separately" });
  });
  it("a closed need names its certificate without exposing its raw identifier", () => {
    mount({ ...suggestion, status: "CLOSED", closed_certificate_uuid: "internal-uuid",
      closingCertificateLabel: "Advanced course · TEST-123", closureReason: "Covers the contract end." });
    expect(screen.getByText("Certificate: Advanced course · TEST-123")).toBeTruthy();
    expect(screen.getByText("Covers the contract end.")).toBeTruthy();
    expect(screen.queryByText(/internal-uuid/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });
  it("failures never display server error text", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('500 {"sql":"private"}'));
    mount(); fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("The training need could not be updated. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/private/)).toBeNull();
  });
});
