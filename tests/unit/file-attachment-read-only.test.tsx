import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileAttachmentDialog, type FileAttachment } from "../../client/src/components/FileAttachmentDialog";

const attachment: FileAttachment = {
  id: "fixture-file", name: "TEST-ONLY.pdf", type: "application/pdf",
  size: 12, data: "data:application/pdf;base64,JVBERi0xLjQ=", uploadedAt: "2026-10-20",
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("View-only attachment access", () => {
  it("keeps preview and download available without upload or removal", () => {
    const change = vi.fn();
    render(<FileAttachmentDialog open onOpenChange={vi.fn()} attachments={[attachment]}
      onAttachmentsChange={change} readOnly />);
    expect(screen.getByTestId("button-preview-fixture-file").hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("button-download-fixture-file").hasAttribute("disabled")).toBe(false);
    expect(screen.queryByTestId("input-file-attachment")).toBeNull();
    expect(screen.queryByTestId("button-upload-file")).toBeNull();
    expect(screen.queryByTestId("button-remove-fixture-file")).toBeNull();
    expect(change).not.toHaveBeenCalled();
  });

  it("preserves the existing editing controls for other callers", () => {
    const change = vi.fn();
    render(<FileAttachmentDialog open onOpenChange={vi.fn()} attachments={[attachment]}
      onAttachmentsChange={change} />);
    expect(screen.getByTestId("input-file-attachment")).toBeTruthy();
    expect(screen.getByTestId("button-upload-file")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-remove-fixture-file"));
    expect(change).toHaveBeenCalledTimes(1);
  });
});
