export interface PageMeta {
  page: string;
  menu: string;
  path: string;
}

export const PAGE_META: PageMeta[] = [
  {
    page: "pay-elements",
    menu: "Account Pay Elements",
    path: "/accounts/master-tables/pay-elements",
  },
  {
    page: "wage-scales",
    menu: "Account Wage Scales",
    path: "/accounts/master-tables/wage-scales",
  },
  {
    page: "cba-reference",
    menu: "Account CBA Reference",
    path: "/accounts/master-tables/cba-reference",
  },
  {
    page: "payroll-run",
    menu: "Account Payroll Run",
    path: "/accounts/payroll/payroll-run",
  },
  {
    page: "portage-bill",
    menu: "Account Portage Bill",
    path: "/accounts/payroll/portage-bill",
  },
  {
    page: "monthly-transactions",
    menu: "Account Monthly Transactions",
    path: "/accounts/payroll/monthly-transactions",
  },
  {
    page: "settlements",
    menu: "Account Settlements",
    path: "/accounts/payroll/settlements",
  },
  {
    page: "vessel-portage",
    menu: "Account Vessel Portage",
    path: "/accounts/payroll/vessel-portage",
  },
  {
    page: "allotments-cash",
    menu: "Account Allotments",
    path: "/accounts/crew-finance/allotments-cash",
  },
  {
    page: "contracts",
    menu: "Account Contracts",
    path: "/accounts/payroll/contracts",
  },
  {
    page: "payslips",
    menu: "Account Payslips",
    path: "/accounts/reports/payslips",
  },
  {
    page: "gl-export",
    menu: "Account GL Export",
    path: "/accounts/reports/gl-export",
  },
  {
    page: "fleet-summary",
    menu: "Account Fleet Summary",
    path: "/accounts/reports/fleet-summary",
  },
  {
    page: "tenant-config",
    menu: "Account Tenant Configuration",
    path: "/accounts/admin/tenant-config",
  },
];

/** Legacy path segments that redirect to a current page. */
export const LEGACY_PAGE_ALIASES: Record<string, string> = {
  allotments: "allotments-cash",
  "cash-bond": "allotments-cash",
};

/** Contract detail URLs: /accounts/payroll/contracts/<engagementUuid>. */
export function contractUuidFromPath(loc: string): string | undefined {
  const segs = loc.split("/").filter(Boolean);
  if (segs.length >= 2 && segs[segs.length - 2] === "contracts") {
    return segs[segs.length - 1];
  }
  return undefined;
}

/** Resolve the Accounts page key for a location path (legacy aliases included). */
export function pageFromPath(loc: string): string | undefined {
  if (contractUuidFromPath(loc)) return "contracts";
  const segs = loc.split("/").filter(Boolean);
  const last = segs[segs.length - 1];
  const resolved = LEGACY_PAGE_ALIASES[last] ?? last;
  return PAGE_META.find((m) => m.page === resolved)?.page;
}
