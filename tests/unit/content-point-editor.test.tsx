import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentPointEditor } from "../../client/src/components/configured-form/ContentPointEditor";
import { pasteNotice } from "../../shared/v2/forms-engine/restrictedPaste";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Company Form Content editor", () => {
  it("shows the shared removal notice when Word HTML loses formatting on paste", async () => {
    render(<ContentPointEditor html="" onChange={vi.fn()} disabled={false} />);
    const editor = await waitFor(() => {
      const element = screen.getByTestId("content-point-input").querySelector(".tiptap");
      expect(element).not.toBeNull();
      return element!;
    });
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", '<p style="color:red">Read <strong>this</strong></p><img src="x">');
    clipboardData.setData("text/plain", "Read this");
    fireEvent.paste(editor, { clipboardData });
    await waitFor(() => expect(screen.getByTestId("content-paste-notice").textContent).toBe(pasteNotice(true)));
    expect(editor.querySelector("img")).toBeNull();
    expect(editor.textContent).toContain("Read this");
  });
});