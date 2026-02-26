import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import HeaderComponent from "./components/Navbar/HeaderComponent";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useTenantInit } from "@/hooks/useTenantInit";

const AdminRouter = lazy(() => import("./modules/admin/index"));
const AppraisalsRouter = lazy(() => import("./modules/crewing/AppraisalsRouter"));
const RecruitmentWrapper = lazy(() => import("./modules/recruitment/RecruitmentWrapper").then(m => ({ default: m.RecruitmentWrapper })));
const CrewPoolModuleRouter = lazy(() => import("./modules/crew-pool").then(m => ({ default: m.CrewPoolModuleRouter })));
const VesselRouter = lazy(() => import("./modules/vessel/index"));
const RotationRouter = lazy(() => import("./modules/rotation/index"));
const PromotionsRouter = lazy(() => import("./modules/promotions/index"));
const DrugsAlcoholModule = lazy(() => import("./modules/drugs-alcohol/index").then(m => ({ default: m.DrugsAlcoholModule })));
const RestHoursModuleComponent = lazy(() => import("./modules/rest-hours").then(m => ({ default: m.RestHoursModule })));
const RestHoursVesselOverviewComponent = lazy(() => import("./modules/rest-hours").then(m => ({ default: m.RestHoursVesselOverview })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ReportsComingSoon = lazy(() => import("./pages/ReportsComingSoon").then(m => ({ default: m.ReportsComingSoon })));
const AccountsModule = lazy(() => import("./modules/accounts/AccountsModule").then(m => ({ default: m.AccountsModule })));
const NotFound = lazy(() => import("./modules/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function TenantErrorPopup({ error }: { error: string }) {
  const handleBack = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    let portNumber = window.location.port;
    portNumber = portNumber ? `:${portNumber}` : "";
    const fullUrl = `${protocol}//${hostname}${portNumber}`;
    localStorage.removeItem("tenantId");
    localStorage.setItem("selected_module", "U2FsdGVkX19gp34OrOluh/gJ6eeByT19nc8eMBUBsVE=");
    window.location.assign(`${fullUrl}/audit/dashboard/summary`);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" data-testid="tenant-error-overlay">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-8 flex flex-col items-center gap-4 text-center" data-testid="tenant-error-popup">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold text-foreground">Connection Error</h2>
        <p className="text-sm text-muted-foreground" data-testid="tenant-error-message">{error}</p>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="button-tenant-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    </div>
  );
}

function TenantLoader() {
  return (
    <div className="flex items-center justify-center h-screen w-full bg-background" data-testid="tenant-loading-screen">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting to tenant database...</p>
      </div>
    </div>
  );
}

function App() {
  const { isLoading, error, isResolved } = useTenantInit();

  if (isLoading) return <TenantLoader />;

  const tenantError = error && !isResolved;

  return (
    <QueryClientProvider client={queryClient}>
      <PermissionsProvider>
        <TooltipProvider>
          <div className={`bg-transparent flex flex-row justify-center w-full h-screen${tenantError ? " pointer-events-none opacity-50" : ""}`} data-testid="app-root">
            <div className="bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%] h-screen w-full pt-[67px] overflow-y-auto" data-testid="main-content" role="main">
              <HeaderComponent />
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path="/">
                    <ProtectedRoute menuName="Crewing"><AppraisalsRouter /></ProtectedRoute>
                  </Route>
                  <Route path="/dashboard" component={DashboardPage} />
                  <Route path="/recruitment">
                    <ProtectedRoute menuName="Recruitment"><RecruitmentWrapper /></ProtectedRoute>
                  </Route>
                  <Route path="/crew-pool">
                    <ProtectedRoute menuName="Crew Pool"><CrewPoolModuleRouter /></ProtectedRoute>
                  </Route>
                  <Route path="/vessel">
                    <ProtectedRoute menuName="Vessel"><VesselRouter /></ProtectedRoute>
                  </Route>
                  <Route path="/rotation">
                    <ProtectedRoute menuName="Rotation"><RotationRouter /></ProtectedRoute>
                  </Route>
                  <Route path="/promotions">
                    <ProtectedRoute menuName="Promotions"><PromotionsRouter /></ProtectedRoute>
                  </Route>
                  <Route path="/drugs-alcohol">
                    <ProtectedRoute menuName="Drugs Alcohol"><DrugsAlcoholModule /></ProtectedRoute>
                  </Route>
                  <Route path="/rest-hours/vessel/:vesselId/:month">
                    {(params) => <ProtectedRoute menuName="Rest Hours"><RestHoursVesselOverviewComponent {...params} /></ProtectedRoute>}
                  </Route>
                  <Route path="/rest-hours/:rest*">
                    <ProtectedRoute menuName="Rest Hours"><RestHoursModuleComponent /></ProtectedRoute>
                  </Route>
                  <Route path="/rest-hours">
                    <ProtectedRoute menuName="Rest Hours"><RestHoursModuleComponent /></ProtectedRoute>
                  </Route>
                  <Route path="/reports">
                    <ProtectedRoute menuName="Reports"><ReportsComingSoon /></ProtectedRoute>
                  </Route>
                  <Route path="/admin/*">
                    <ProtectedRoute menuName="Admin"><AdminRouter /></ProtectedRoute>
                  </Route>
                  <Route path="/admin">
                    <ProtectedRoute menuName="Admin"><AdminRouter /></ProtectedRoute>
                  </Route>
                  <Route path="/accounts/:path*" component={AccountsModule} />
                  <Route path="/accounts" component={AccountsModule} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </div>
          </div>
          <Toaster />
          {tenantError && <TenantErrorPopup error={error} />}
        </TooltipProvider>
      </PermissionsProvider>
    </QueryClientProvider>
  );
}

export default App;
