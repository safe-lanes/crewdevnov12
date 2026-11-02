import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyPdfActions } from "@/components/configured-form/CompanyPdfActions";
import { apiRequest } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));
afterEach(cleanup);

describe("Company PDF handover in-app confirmation", () => {
  it.each([false, true])("cancels without writing, then confirms exactly once (voided=%s)", async voided => {
    const hash = "f".repeat(64);
    const api = vi.mocked(apiRequest);
    api.mockReset().mockImplementation(async () => new Response(JSON.stringify({
      status: "ready", voided, fileSha256: hash, canRetry: false, canFillIn: true, handovers: [],
    }), { status: 200 }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}>
      <CompanyPdfActions submissionUuid="fixture-form" completed canFillIn />
    </QueryClientProvider>);
    const label = voided ? "Void notice handed to seafarer" : "Copy handed to seafarer";
    const message = voided ? "Record that the void notice was handed to the seafarer?" : "Record that this PDF was handed to the seafarer?";
    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Do not record" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: label }));
    fireEvent.click(await screen.findByRole("button", { name: "Record handover", exact: true }));
    await waitFor(() => expect(api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(1));
    expect(api).toHaveBeenCalledWith("POST",
      `/api/v2/company-form-submissions/fixture-form/pdf/${voided ? "void-notice-handover" : "handover"}`,
      { fileSha256: hash });
    client.clear();
  });
});
