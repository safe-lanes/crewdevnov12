import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import HeaderComponent from "./components/Navbar/HeaderComponent";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useTenantInit } from "@/hooks/useTenantInit";
import { isAuthRequired, redirectToLogin, getAuthToken, hasParentLoginUrl } from "@/lib/authToken";
import { clearTenantData } from "@/lib/tenantStorage";

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
const TrainingRetentionModuleComponent = lazy(() => import("./modules/training-retention").then(m => ({ default: m.TrainingRetentionModule })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const AccountsModule = lazy(() => import("./modules/accounts/AccountsModule").then(m => ({ default: m.AccountsModule })));
const NotFound = lazy(() => import("./modules/not-found"));

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const ChangePasswordPage = lazy(() => import("./pages/auth/ChangePasswordPage"));

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
    clearTenantData();
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

function AuthenticatedApp() {
  const { isLoading, error, isResolved } = useTenantInit();

  if (isLoading || !isResolved) return <TenantLoader />;

  const tenantError = !!error;

  return (
    <PermissionsProvider>
      <div className={`bg-transparent flex flex-row justify-center w-full h-screen${tenantError ? " pointer-events-none opacity-50" : ""}`} data-testid="app-root">
        <div className="bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%] h-screen w-full pt-[67px] overflow-y-auto" data-testid="main-content" role="main">
          <HeaderComponent />
          <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route path="/">
                <ProtectedRoute menuName="Crewing"><AppraisalsRouter /></ProtectedRoute>
              </Route>
              <Route path="/dashboard">
                    <ProtectedRoute menuName="Dashboard" fallbackRoute="/recruitment"><DashboardPage /></ProtectedRoute>
                  </Route>
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
                  <Route path="/training-retention/training">
                    <ProtectedRoute menuName="Training & Ret."><TrainingRetentionModuleComponent /></ProtectedRoute>
                  </Route>
                  <Route path="/training-retention/retention">
                    <ProtectedRoute menuName="Training & Ret."><TrainingRetentionModuleComponent /></ProtectedRoute>
                  </Route>
                  <Route path="/training-retention/:rest*">
                    <ProtectedRoute menuName="Training & Ret."><TrainingRetentionModuleComponent /></ProtectedRoute>
                  </Route>
                  <Route path="/training-retention">
                    <ProtectedRoute menuName="Training & Ret."><TrainingRetentionModuleComponent /></ProtectedRoute>
                  </Route>
              <Route path="/reports">
                <ProtectedRoute menuName="Reports"><ReportsPage /></ProtectedRoute>
              </Route>
              <Route path="/admin/*">
                <ProtectedRoute menuName="Admin"><AdminRouter /></ProtectedRoute>
              </Route>
              <Route path="/admin">
                <ProtectedRoute menuName="Admin"><AdminRouter /></ProtectedRoute>
              </Route>
              <Route path="/change-password" component={ChangePasswordPage} />
              <Route path="/accounts/:path*" component={AccountsModule} />
              <Route path="/accounts" component={AccountsModule} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </div>
      </div>
      {tenantError && <TenantErrorPopup error={error} />}
    </PermissionsProvider>
  );
}

function ProtectedShell() {
  // Render-time guard: if there is no auth token we must NEVER render the
  // protected app shell — not even for one frame. This protects against the
  // browser's back/forward cache (BFCache) restoring a previously-rendered
  // protected page after logout, because wouter's <Redirect> commits a route
  // change synchronously during render rather than waiting for an effect to
  // run (which BFCache restores skip).
  if (isAuthRequired() && !getAuthToken()) {
    // If a parent login URL is configured, hand off to it instead of
    // committing a wouter SPA <Redirect to="/login">. This is the same
    // single-env-var rule as logout(), and it prevents the render-time
    // guard from racing logout()'s window.location.replace and "winning"
    // with a stray /login navigation.
    if (hasParentLoginUrl()) {
      redirectToLogin();
      return <TenantLoader />;
    }
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    return <Redirect to={`/login?next=${next}`} replace />;
  }
  return <AuthenticatedApp />;
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  // If an authenticated user lands on /login (e.g. by pressing Back to a
  // BFCache-cached login page after signing in), send them straight to the
  // app root instead of showing the sign-in form.
  if (isAuthRequired() && !!getAuthToken()) {
    return <Redirect to="/" replace />;
  }
  return <>{children}</>;
}

function BFCacheGuard() {
  // When a page is restored from the browser's BFCache, React effects do
  // NOT re-run and the in-memory component tree is shown as-is. If the user
  // logged out in another tab (or in this tab and then pressed Back), we
  // must evict the cached protected UI by forcing a fresh navigation.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return; // only react to BFCache restores
      if (!isAuthRequired() || getAuthToken()) return;
      // If the cached page being restored is already /login there is
      // nothing to evict — and routing through redirectToLogin() here
      // would set its module-level `redirecting` flag without actually
      // navigating, suppressing future logout/redirect calls.
      if (window.location.pathname === "/login") return;
      // Mode-aware redirect: parent-mode sessions hand off to the
      // external login URL; standalone sessions get the `?next=`
      // round-trip preserved.
      redirectToLogin();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BFCacheGuard />
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/login">
              <LoginGuard><LoginPage /></LoginGuard>
            </Route>
            <Route path="/forgot-password" component={ForgotPasswordPage} />
            <Route path="/reset-password" component={ResetPasswordPage} />
            <Route component={ProtectedShell} />
          </Switch>
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
