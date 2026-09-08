import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ userType: "Office" }),
}));

import "@/fixedPartRegistrations";
import { getFixedParts } from "@/components/configured-form/fixedPartRegistry";
import { briefingFixedParts } from "@/modules/crew-pool/components/BriefingFixedParts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderNodes(nodes: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<>{nodes}</>);
  });
}

function byTestId(testId: string): HTMLElement {
  const element = container?.querySelector(`[data-testid="${testId}"]`);
  if (!element) throw new Error(`Missing data-testid="${testId}"`);
  return element as HTMLElement;
}

function hasText(text: string): boolean {
  return container?.textContent?.includes(text) ?? false;
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("fixed-part preview registry", () => {
  it("normalizes category lookup and leaves unknown categories unregistered", () => {
    expect(getFixedParts("  BRIEFING  ", { readOnly: true })).toBeDefined();
    expect(getFixedParts("unregistered-form", { readOnly: true })).toBeUndefined();
  });

  it.each([
    ["briefing", "briefing-part-a", "briefing-part-c", "input-briefing-part-a-date"],
    ["debriefing", "debriefing-part-a", "debriefing-part-c", "input-debriefing-date"],
  ])("renders %s A/C read-only with no actions", async (category, partA, partC, dateInput) => {
    const parts = getFixedParts(category, { readOnly: true });
    await renderNodes(<>{parts?.A}{parts?.C}</>);

    expect(byTestId(partA)).toBeTruthy();
    expect(byTestId(partC)).toBeTruthy();
    expect((byTestId(dateInput) as HTMLInputElement).disabled).toBe(true);
    expect((container?.querySelector('[role="combobox"]') as HTMLButtonElement).disabled).toBe(true);
    expect((container?.querySelector("textarea") as HTMLTextAreaElement).disabled).toBe(true);
    expect(hasText("Save Part A")).toBe(false);
    expect(hasText("Save review")).toBe(false);
    expect(hasText("—")).toBe(true);
  });

  it("renders Interview A/C read-only with no actions", async () => {
    const parts = getFixedParts("interview", { readOnly: true });
    await renderNodes(<>{parts?.A}{parts?.C}</>);

    expect(byTestId("interview-part-a")).toBeTruthy();
    expect(byTestId("interview-part-c")).toBeTruthy();
    expect((byTestId("input-interview-category") as HTMLInputElement).disabled).toBe(true);
    expect((byTestId("input-interview-stage") as HTMLInputElement).disabled).toBe(true);
    expect((byTestId("textarea-interview-office-comments") as HTMLTextAreaElement).disabled).toBe(true);
    expect(hasText("Save Part A")).toBe(false);
    expect(hasText("Save review")).toBe(false);
  });

  it("keeps the live factory interactive by default", async () => {
    const parts = briefingFixedParts("submission-1", {}, false, vi.fn());
    await renderNodes(<>{parts.A}{parts.C}</>);

    expect((byTestId("input-briefing-part-a-date") as HTMLInputElement).disabled).toBe(false);
    expect((container?.querySelector('[role="combobox"]') as HTMLButtonElement).disabled).toBe(false);
    expect(hasText("Save Part A")).toBe(true);
    expect(hasText("Save review")).toBe(true);
  });
});