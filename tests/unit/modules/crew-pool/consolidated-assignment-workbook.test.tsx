import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VesselAssignmentImportDialog } from "@/modules/crew-pool/VesselAssignmentImportDialog";

const toast = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

describe("consolidated assignment workbook download", () => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:consolidated-workbook"),
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalCreateObjectURL) {
      Object.defineProperty(window.URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
    } else {
      delete (window.URL as URLConstructor).createObjectURL;
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(window.URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    } else {
      delete (window.URL as URLConstructor).revokeObjectURL;
    }
  });

  function renderDialog() {
    render(<VesselAssignmentImportDialog isOpen onClose={vi.fn()} />);
  }

  it("shows the consolidated download before a workbook is selected", () => {
    renderDialog();

    expect(screen.getByTestId("consolidated-workbook-download-card")).toBeInTheDocument();
    expect(screen.getByTestId("button-download-consolidated-workbook")).toBeInTheDocument();
    expect(screen.getByText(/Import all crew Excel batches first/i)).toBeInTheDocument();
  });

  it("downloads from the database-backed endpoint without requiring a file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["workbook"]),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();

    const button = screen.getByTestId("button-download-consolidated-workbook");
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByText("Generating…")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/vessel/import/generate-workbook-from-db",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    ));
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByText("Download Consolidated Workbook")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Consolidated workbook downloaded",
    }));
  });

  it("keeps the popup available and reports an error so the download can be retried", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to generate vessel import workbook" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();

    fireEvent.click(screen.getByTestId("button-download-consolidated-workbook"));

    await waitFor(() => {
      expect(screen.getByText("Failed to generate vessel import workbook")).toBeInTheDocument();
    });
    expect(screen.getByTestId("button-download-consolidated-workbook")).not.toBeDisabled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Workbook download failed",
    }));
  });
});