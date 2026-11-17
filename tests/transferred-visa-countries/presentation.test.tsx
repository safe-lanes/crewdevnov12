import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VisaCountryField } from "@/modules/crew-pool/components/VisaCountryField";
import { mapLegacyVisaToV2, mapV2VisaToLegacy } from "@/modules/crew-pool/mappers/v2ToLegacyMapper";
import { visaCountryForSave, visaCountryPresentation } from "@shared/v2/crew-pool/visaCountry";

const uuid = "11111111-1111-4111-8111-111111111111";
const raw = { visaUuid: "visa", countryUuid: uuid, country: uuid, visaType: "work",
  serialNo: "123", issued: "2025-01-01", expiry: "2029-01-01", sortOrder: 3,
  attachments: [{ attUuid: "attachment", fileName: "visa.pdf", filePath: "/test/visa.pdf" }] };

describe("Country identity stays separate from C2 presentation", () => {
  it.each(["China", "INDIA", "AUSTRALIA", "UNITED STATES", "UNITED KINGDOM"])("displays %s with the same visa identity", name => {
    const mapped = mapV2VisaToLegacy({ ...raw, countryName: name });
    expect(mapped.issuingCountry).toBe(name);
    expect(mapped.countryId).toBe(uuid);
    expect(mapped.visaUuid).toBe("visa");
    const props = { value: mapped.issuingCountry, countryId: mapped.countryId, onChange: vi.fn(), onBlur: vi.fn() };
    render(<VisaCountryField {...props} />);
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.queryByText(uuid)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const payload = mapLegacyVisaToV2(mapped);
    expect(payload).toMatchObject({ countryUuid: uuid, country: name, serialNo: "123", issued: raw.issued, expiry: raw.expiry, visaType: "work", sortOrder: 3 });
    expect(mapped.attachments[0].attUuid).toBe("attachment");
  });
  it("hides an unresolved UUID without putting the message into a save", () => {
    const mapped = mapV2VisaToLegacy({ ...raw, countryName: null });
    expect(mapped.issuingCountry).toBe("");
    expect(visaCountryForSave(mapped)).toBe(uuid);
    expect(mapLegacyVisaToV2(mapped)).toMatchObject({ countryUuid: uuid, country: uuid });
    render(<VisaCountryField value={mapped.issuingCountry} countryId={mapped.countryId}
      unavailable={mapped.countryUnavailable} onChange={vi.fn()} onBlur={vi.fn()} />);
    expect(screen.getByText("Country unavailable")).toBeInTheDocument();
    expect(screen.queryByText(uuid)).not.toBeInTheDocument();
    expect(JSON.stringify(mapLegacyVisaToV2(mapped))).not.toContain("Country unavailable");
  });
  it("preserves readable manual text even when an old reference or resolved label differs", () => {
    expect(visaCountryPresentation({ country: "Custom country", countryUuid: uuid, countryName: "INDIA" }))
      .toEqual({ name: "Custom country", unavailable: false });
    const mapped = mapV2VisaToLegacy({ country: "  China  " });
    expect(mapped.issuingCountry).toBe("  China  ");
    const change = vi.fn();
    render(<VisaCountryField value={mapped.issuingCountry} onChange={change} onBlur={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Schengen" } });
    expect(change).toHaveBeenCalledWith("Schengen");
    expect(mapLegacyVisaToV2({ ...mapped, issuingCountry: "Schengen" }).country).toBe("Schengen");
  });
  it("shows an editable missing-country placeholder without using it as input data", () => {
    const mapped = mapV2VisaToLegacy({ country: uuid, countryName: null });
    render(<VisaCountryField value={mapped.issuingCountry} unavailable={mapped.countryUnavailable}
      onChange={vi.fn()} onBlur={vi.fn()} />);
    expect(screen.getByPlaceholderText("Country unavailable")).toHaveValue("");
    expect(visaCountryForSave(mapped)).toBe(uuid);
  });
  it("keeps truly empty fields empty and handles historical text-only references", () => {
    expect(mapV2VisaToLegacy(null).issuingCountry).toBe("");
    expect(visaCountryForSave({ issuingCountry: "" })).toBe("");
    expect(mapV2VisaToLegacy({ countryUuid: "China" }).issuingCountry).toBe("China");
  });
});
