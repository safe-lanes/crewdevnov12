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
import AllotmentsCashPage from "./pages/AllotmentsCashPage";
import ContractsListPage from "./pages/ContractsListPage";
import ContractDetailPage from "./pages/ContractDetailPage";
import PayslipsPage from "./pages/PayslipsPage";
import GlExportPage from "./pages/GlExportPage";
import FleetSummaryPage from "./pages/FleetSummaryPage";

import { PAGE_META, pageFromPath, contractUuidFromPath } from "./pageMeta";

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
      case "allotments-cash":
        return <AllotmentsCashPage />;
      case "contracts": {
        const uuid = contractUuidFromPath(location);
        return uuid ? (
          <ContractDetailPage engagementUuid={uuid} />
        ) : (
          <ContractsListPage />
        );
      }
      case "payslips":
        return <PayslipsPage />;
      case "gl-export":
        return <GlExportPage />;
      case "fleet-summary":
        return <FleetSummaryPage />;
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
