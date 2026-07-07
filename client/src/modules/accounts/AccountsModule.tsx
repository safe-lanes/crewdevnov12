import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { usePermissions } from "@/contexts/PermissionsContext";
import { NoAccessPage } from "@/components/ProtectedRoute";
import MainLayout from "@/components/main/MainLayout";
import AccountsSideBar from "./AccountsSideBar";
import TenantConfigPage from "./pages/TenantConfigPage";
import PayElementsPage from "./pages/PayElementsPage";
import WageScalesPage from "./pages/WageScalesPage";
import CbaReferencePage from "./pages/CbaReferencePage";
import PayrollRunPage from "./pages/PayrollRunPage";
import PortageBillPage from "./pages/PortageBillPage";
import MonthlyTransactionsPage from "./pages/MonthlyTransactionsPage";
import SettlementsPage from "./pages/SettlementsPage";
import VesselPortagePage from "./pages/VesselPortagePage";
import AllotmentsPage from "./pages/AllotmentsPage";
import CashBondPage from "./pages/CashBondPage";

interface PageMeta {
  page: string;
  menu: string;
  path: string;
}

const PAGE_META: PageMeta[] = [
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
    page: "allotments",
    menu: "Account Allotments",
    path: "/accounts/crew-finance/allotments",
  },
  {
    page: "cash-bond",
    menu: "Account Cash & Bond",
    path: "/accounts/crew-finance/cash-bond",
  },
  {
    page: "tenant-config",
    menu: "Account Tenant Configuration",
    path: "/accounts/admin/tenant-config",
  },
];

function pageFromPath(loc: string): string | undefined {
  const segs = loc.split("/").filter(Boolean);
  const last = segs[segs.length - 1];
  return PAGE_META.find((m) => m.page === last)?.page;
}

export function AccountsModule() {
  const [location, setLocation] = useLocation();
  const { canView, isLoading } = usePermissions();

  const allowedPages = useMemo(
    () => PAGE_META.filter((m) => canView(m.menu)).map((m) => m.page),
    [canView],
  );

  const selected = pageFromPath(location) ?? allowedPages[0] ?? "";

  // Redirect bare/unknown routes to the first page the user may view.
  useEffect(() => {
    if (isLoading || allowedPages.length === 0) return;
    const current = pageFromPath(location);
    if (!current || !allowedPages.includes(current)) {
      const target = PAGE_META.find((m) => m.page === allowedPages[0]);
      if (target && location !== target.path) setLocation(target.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, allowedPages, isLoading]);

  const setSelected = (page: string) => {
    const target = PAGE_META.find((m) => m.page === page);
    if (target) setLocation(target.path);
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center w-full min-h-[calc(100vh-67px)] bg-[#f8fafc] text-sm text-muted-foreground"
        data-testid="accounts-loading"
      >
        Loading…
      </div>
    );
  }

  if (allowedPages.length === 0) {
    return <NoAccessPage menuName="Accounts" />;
  }

  const renderContent = () => {
    switch (selected) {
      case "tenant-config":
        return <TenantConfigPage />;
      case "pay-elements":
        return <PayElementsPage />;
      case "wage-scales":
        return <WageScalesPage />;
      case "cba-reference":
        return <CbaReferencePage />;
      case "payroll-run":
        return <PayrollRunPage />;
      case "portage-bill":
        return <PortageBillPage />;
      case "monthly-transactions":
        return <MonthlyTransactionsPage />;
      case "settlements":
        return <SettlementsPage />;
      case "vessel-portage":
        return <VesselPortagePage />;
      case "allotments":
        return <AllotmentsPage />;
      case "cash-bond":
        return <CashBondPage />;
      default:
        return null;
    }
  };

  return (
    <div data-testid="accounts-v2-container">
      <AccountsSideBar
        selected={selected}
        setSelected={setSelected}
        allowedPages={allowedPages}
      />
      <MainLayout hasSidebar={true}>
        <div className="h-full">{renderContent()}</div>
      </MainLayout>
    </div>
  );
}
