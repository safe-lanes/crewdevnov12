import React from "react";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentPointEditor } from "../../client/src/components/configured-form/ContentPointEditor";
import { TABLE_REMOVAL_NOTICE, IMAGE_REMOVAL_NOTICE } from "../../shared/v2/forms-engine/restrictedPaste";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Company Form Content editor", () => {
  it("notices table and image removal, but not ordinary Word styling", async () => {
    render(<ContentPointEditor html="" onChange={vi.fn()} disabled={false} />);
    const editor = await waitFor(() => {
      const element = screen.getByTestId("content-point-input").querySelector(".tiptap");
      expect(element).not.toBeNull();
      return element!;
    });
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/html", readFileSync("tests/fixtures/word-paste-1.html", "utf8"));
    clipboardData.setData("text/plain", "Fixture 1");
    fireEvent.paste(editor, { clipboardData });
    expect(screen.queryByTestId("content-paste-notice")).toBeNull();
    const tableData = new DataTransfer();
    tableData.setData("text/html", readFileSync("tests/fixtures/word-paste-2.html", "utf8"));
    tableData.setData("text/plain", "Fixture 2");
    fireEvent.paste(editor, { clipboardData: tableData });
    await waitFor(() => expect(screen.getByTestId("content-paste-notice").textContent).toBe(TABLE_REMOVAL_NOTICE));
    const imageData = new DataTransfer();
    imageData.setData("text/html", '<p style="color:red">Read <strong>this</strong></p><img src="x">');
    imageData.setData("text/plain", "Read this");
    fireEvent.paste(editor, { clipboardData: imageData });
    await waitFor(() => expect(screen.getByTestId("content-paste-notice").textContent).toBe(IMAGE_REMOVAL_NOTICE));
    expect(editor.querySelector("img")).toBeNull();
  });
});