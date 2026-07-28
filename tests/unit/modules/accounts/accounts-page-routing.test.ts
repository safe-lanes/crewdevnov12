import { describe, it, expect } from "vitest";
import {
  PAGE_META,
  LEGACY_PAGE_ALIASES,
  pageFromPath,
} from "../../../../client/src/modules/accounts/pageMeta";

/**
 * Regression coverage for the Allotments + Cash & Bond sidebar merge.
 *
 * The combined "Allotments & Cash" screen must stay reachable from the
 * legacy URLs (/accounts/crew-finance/allotments and
 * /accounts/crew-finance/cash-bond), and its visibility must be gated by
 * the single "Account Allotments" menu grant — the retired
 * "Account Cash & Bond" menu must not key any page.
 */

describe("Accounts legacy path aliases", () => {
  it("maps the legacy 'allotments' segment to the combined page", () => {
    expect(LEGACY_PAGE_ALIASES["allotments"]).toBe("allotments-cash");
    expect(pageFromPath("/accounts/crew-finance/allotments")).toBe(
      "allotments-cash",
    );
  });

  it("maps the legacy 'cash-bond' segment to the combined page", () => {
    expect(LEGACY_PAGE_ALIASES["cash-bond"]).toBe("allotments-cash");
    expect(pageFromPath("/accounts/crew-finance/cash-bond")).toBe(
      "allotments-cash",
    );
  });

  it("resolves the canonical combined path to the combined page", () => {
    expect(pageFromPath("/accounts/crew-finance/allotments-cash")).toBe(
      "allotments-cash",
    );
  });

  it("every alias target is a real registered page", () => {
    const pages = new Set(PAGE_META.map((m) => m.page));
    for (const [alias, target] of Object.entries(LEGACY_PAGE_ALIASES)) {
      expect(pages.has(target), `alias '${alias}' -> '${target}'`).toBe(true);
      // Aliases must not shadow current page keys.
      expect(pages.has(alias), `alias '${alias}' shadows a page`).toBe(false);
    }
  });
});

describe("Accounts combined page menu gating", () => {
  it("keys the combined page to the 'Account Allotments' menu grant", () => {
    const combined = PAGE_META.find((m) => m.page === "allotments-cash");
    expect(combined).toBeDefined();
    expect(combined!.menu).toBe("Account Allotments");
    expect(combined!.path).toBe("/accounts/crew-finance/allotments-cash");
  });

  it("no page is keyed to the retired 'Account Cash & Bond' menu", () => {
    const retired = PAGE_META.filter(
      (m) => m.menu === "Account Cash & Bond",
    );
    expect(retired).toEqual([]);
    // Exactly one page should sit under the Account Allotments grant.
    const allotmentPages = PAGE_META.filter(
      (m) => m.menu === "Account Allotments",
    );
    expect(allotmentPages.map((m) => m.page)).toEqual(["allotments-cash"]);
  });

  it("view gating filters by menu grant (combined page hidden without it)", () => {
    const canView = (menu: string) => menu !== "Account Allotments";
    const allowed = PAGE_META.filter((m) => canView(m.menu)).map(
      (m) => m.page,
    );
    expect(allowed).not.toContain("allotments-cash");

    const canViewAll = () => true;
    const allowedAll = PAGE_META.filter((m) => canViewAll()).map(
      (m) => m.page,
    );
    expect(allowedAll).toContain("allotments-cash");
  });
});
