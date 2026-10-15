import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExcelImportCandidateDialog } from "../../client/src/modules/recruitment/ExcelImportCandidateDialog";
import { importRequest } from "../../client/src/modules/recruitment/importRequest";

vi.mock("../../client/src/modules/recruitment/importRequest", () => ({ importRequest: vi.fn() }));
vi.mock("@/lib/crewUser", () => ({ getCrewUserId: () => null }));
const good = { isValid: true, candidateName: "Test", status: "Applied", summary: { A1: 1 }, errors: [] };
const props = () => ({ open: true, onOpenChange: vi.fn(), onImportSuccess: vi.fn(), onOpenCandidate: vi.fn() });
const select = () => fireEvent.change(document.getElementById("candidate-excel-file")!, { target: { files: [new File(["fixture"], "candidate.xlsx")] } });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.mocked(importRequest).mockReset(); });
afterEach(cleanup);

describe("Candidate upload confirmation safety", () => {
  it("invalidates a successful preview after an execution rejection and requires validation again", async () => {
    vi.mocked(importRequest).mockResolvedValueOnce(response(good)).mockResolvedValueOnce(response({ code: "CELL_VALIDATION", message: "Correct the workbook errors before importing.", errors: [{ section: "A1", sheet: "APPLICATION FORM", cell: "V7", field: "Date of birth", message: "Enter a valid date." }] }, 422));
    render(<ExcelImportCandidateDialog {...props()} />);
    select();
    fireEvent.click(screen.getByRole("button", { name: "Validate workbook" }));
    await screen.findByText("Ready to import");
    fireEvent.click(screen.getByRole("button", { name: "Confirm & import candidate" }));
    await screen.findByText("Import not confirmed");
    expect(screen.getByRole("button", { name: "Confirm & import candidate" })).toBeDisabled();
    expect(screen.queryByText("Ready to import")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Check the candidate list");
  });
  it("does not describe a successful import as failed if the list refresh fails", async () => {
    vi.mocked(importRequest).mockResolvedValueOnce(response(good)).mockResolvedValueOnce(response({ success: true, recCanUuid: "synthetic", status: "Applied" }));
    const callbacks = props();
    callbacks.onImportSuccess.mockRejectedValueOnce(new Error("private refresh error"));
    const view = render(<ExcelImportCandidateDialog {...callbacks} />);
    select();
    fireEvent.click(screen.getByRole("button", { name: "Validate workbook" }));
    await screen.findByText("Ready to import");
    fireEvent.click(screen.getByRole("button", { name: "Confirm & import candidate" }));
    await screen.findByText("Candidate imported");
    expect(screen.getByRole("alert")).toHaveTextContent("Do not import it again");
    expect(screen.getByRole("button", { name: "Open Candidate" })).toBeDisabled();
    expect(screen.queryByText("private refresh error")).not.toBeInTheDocument();
    view.rerender(<ExcelImportCandidateDialog {...callbacks} open={false} />);
    view.rerender(<ExcelImportCandidateDialog {...callbacks} open={true} />);
    await waitFor(() => expect(screen.getByText("No workbook selected")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Confirm & import candidate" })).toBeDisabled();
  });
});
