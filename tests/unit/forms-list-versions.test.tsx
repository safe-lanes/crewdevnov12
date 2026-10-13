import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readListVersions, storedStandardVersion } from "../../client/src/modules/admin/formsListVersions";
import { VersionLoadStatus } from "../../client/src/modules/admin/components/VersionLoadStatus";

const version = (id: number, versionNo: string, status: string) =>
  ({ id, formId: 1, rankGroupId: 7, versionNo, versionDate: "03-Jun-2026", status });

describe("Truthful Forms Configuration versions", () => {
  it("does not manufacture a version when a rank group has none", () => {
    expect(storedStandardVersion([], 7)).toBeUndefined();
  });
  it("shows the actual released version rather than labeling it with a later draft's status", () => {
    expect(storedStandardVersion([version(1, "09", "released"), version(2, "10", "draft")], 7))
      .toEqual(version(1, "09", "released"));
  });
  it("uses a real draft's own number and date only when no release exists", () => {
    expect(storedStandardVersion([version(1, "03", "draft")], 7)).toEqual(version(1, "03", "draft"));
    expect(storedStandardVersion([version(1, "03", "draft")], 8)).toBeUndefined();
  });
  it("refuses malformed responses rather than replacing them with an empty successful list", () => {
    expect(() => readListVersions({ error: "unavailable" })).toThrow();
    expect(() => readListVersions([{ versionNo: "00" }])).toThrow();
    expect(readListVersions([])).toEqual([]);
  });
  it("shows a plain row error and actionable Retry without a fabricated date or status", () => {
    const retry = vi.fn();
    render(<VersionLoadStatus state="error" retry={retry} />);
    expect(screen.getByRole("alert").textContent).toBe("Could not loadRetry");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    cleanup();
  });
});
