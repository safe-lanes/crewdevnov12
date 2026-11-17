import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { VisaSelectionDialog } from "@/modules/crew-pool/VisaSelectionDialog";
import { recruitmentVisaCountryKeys, recruitmentVisaCountryLabel } from "@/modules/recruitment/visaCountryMatching";
import { masterReference } from "@/modules/recruitment/masterLabels";
import { DEFAULT_VISA_COUNTRIES } from "@shared/visaCountryTemplates";

const query = vi.hoisted(() => ({ data: [] as unknown[], isLoading: false }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => query }));
const indiaId = "11111111-1111-4111-8111-111111111111";
const australiaId = "22222222-2222-4222-8222-222222222222";
const catalog = [{ id: indiaId, label: "INDIA" }, { id: australiaId, label: "AUSTRALIA" }];
const saved = [
  { countryId: "CHN", issuingCountry: "China" },
  { countryId: indiaId, issuingCountry: indiaId },
  { countryId: australiaId, issuingCountry: australiaId },
];
const row = (name: string) => screen.getByText(name, { selector: "span" }).closest("tr")!;
const checkbox = (name: string) => within(row(name)).getByRole("checkbox");
function popup(keys: string[], onConfirm = vi.fn()) {
  return <VisaSelectionDialog open onClose={() => {}} onConfirm={onConfirm} existingCountryIds={keys} />;
}
function expectAdded(name: string) {
  expect(within(row(name)).getByText("Added")).toBeInTheDocument();
  expect(checkbox(name)).toBeDisabled();
}

describe("Recruitment visa matching keys", () => {
  it("resolves saved UUIDs and leaves records and save references unchanged", () => {
    const original = JSON.stringify(saved);
    const keys = recruitmentVisaCountryKeys(saved, catalog);
    expect(keys).toEqual(expect.arrayContaining(["China", indiaId, "INDIA", australiaId, "AUSTRALIA"]));
    expect(JSON.stringify(saved)).toBe(original);
    expect(masterReference(saved[1].issuingCountry, catalog)).toBe(indiaId);
    expect(masterReference(saved[2].issuingCountry, catalog)).toBe(australiaId);
    expect(recruitmentVisaCountryLabel(saved[1], catalog)).toBe("INDIA");
  });
  it("uses saved names while catalogs are unavailable", () => {
    expect(recruitmentVisaCountryKeys([{ countryId: indiaId, issuingCountry: indiaId, countryName: "INDIA" }], []))
      .toContain("INDIA");
  });
  it("resolves legacy codes and COUNTRY references without changing them", () => {
    const entries = [{ id: 9, name: "Indian", nationality: "Indian" }];
    expect(recruitmentVisaCountryKeys([{ issuingCountry: "COUNTRY-9" }, { issuingCountry: "AUS" }], [], entries))
      .toEqual(expect.arrayContaining(["COUNTRY-9", "India", "AUS", "Australia"]));
  });
  it("does not reuse a stale countryName after manual editing", () => {
    const keys = recruitmentVisaCountryKeys([{ countryId: indiaId, issuingCountry: "Japan", countryName: "India" }], []);
    expect(keys).toContain("Japan");
    expect(keys).not.toContain("India");
  });
  it("omits blank entries and unresolved display messages", () => {
    const keys = recruitmentVisaCountryKeys([{ issuingCountry: "" }, { issuingCountry: "  " }, { issuingCountry: indiaId }], []);
    expect(keys).toEqual([indiaId]);
    expect(keys.some(key => key.startsWith("Unresolved"))).toBe(false);
  });
});

describe("Real shared country popup with Recruitment inputs", () => {
  it("marks China, India and Australia Added after reload", () => {
    render(popup(recruitmentVisaCountryKeys(saved, catalog)));
    ["China", "India", "Australia"].forEach(expectAdded);
    expect(screen.getByText(/country\(ies\) available/)).toHaveTextContent(`${DEFAULT_VISA_COUNTRIES.length - 3} country(ies) available`);
  });
  it("supports manual names with capitalization and surrounding whitespace", () => {
    render(popup(recruitmentVisaCountryKeys([{ issuingCountry: "  iNdIa  " }, { issuingCountry: " AUSTRALIA " }], [])));
    expectAdded("India");
    expectAdded("Australia");
    expect(checkbox("China")).not.toBeDisabled();
  });
  it("updates when country catalogs arrive after visa data", () => {
    const view = render(popup(recruitmentVisaCountryKeys(saved, [])));
    expect(checkbox("India")).not.toBeDisabled();
    view.rerender(popup(recruitmentVisaCountryKeys(saved, catalog)));
    expectAdded("India");
    expectAdded("Australia");
  });
  it("updates deletion and keeps Added while another visa represents that country", () => {
    const india = { issuingCountry: "INDIA" };
    const view = render(popup(recruitmentVisaCountryKeys([india, india], [])));
    expectAdded("India");
    view.rerender(popup(recruitmentVisaCountryKeys([india], [])));
    expectAdded("India");
    view.rerender(popup(recruitmentVisaCountryKeys([], [])));
    expect(checkbox("India")).not.toBeDisabled();
    expect(within(row("India")).queryByText("Added")).not.toBeInTheDocument();
  });
  it("Select Priority excludes existing visas from the confirmation payload", () => {
    const confirm = vi.fn();
    render(popup(recruitmentVisaCountryKeys(saved, catalog), confirm));
    fireEvent.click(screen.getByTestId("button-select-priority-visa"));
    fireEvent.click(screen.getByTestId("button-confirm-visa-selection"));
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0].map((c: { name: string }) => c.name))
      .toEqual(["United States", "Schengen", "United Kingdom"]);
  });
  it("does not conflate distinct country names or partial matches", () => {
    render(popup(recruitmentVisaCountryKeys([{ issuingCountry: "United" }, { issuingCountry: "Indian Ocean" }], [])));
    expect(checkbox("United States")).not.toBeDisabled();
    expect(checkbox("United Kingdom")).not.toBeDisabled();
    expect(checkbox("India")).not.toBeDisabled();
  });
  it("keeps current Crew Pool C2 ID/name input behavior unchanged", () => {
    render(popup(["COUNTRY-9", "INDIA", "AUS", "AUSTRALIA", "CHN", "China"]));
    ["China", "India", "Australia"].forEach(expectAdded);
  });
  it("keeps Added statuses across closing and reopening the popup", () => {
    const keys = recruitmentVisaCountryKeys(saved, catalog);
    const view = render(popup(keys));
    ["China", "India", "Australia"].forEach(expectAdded);
    view.rerender(<VisaSelectionDialog open={false} onClose={() => {}} onConfirm={() => {}} existingCountryIds={keys} />);
    view.rerender(popup(keys));
    ["China", "India", "Australia"].forEach(expectAdded);
  });
});
