import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import HeaderComponent from "./components/Navbar/HeaderComponent";

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-transparent flex flex-row justify-center w-full h-screen" data-testid="app-root">
          <div className="bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%] h-screen w-full pt-[67px] overflow-y-auto" data-testid="main-content" role="main">
            <HeaderComponent />
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={AppraisalsRouter} />
                <Route path="/dashboard" component={DashboardPage} />
                <Route path="/recruitment" component={RecruitmentWrapper} />
                <Route path="/crew-pool" component={CrewPoolModuleRouter} />
                <Route path="/vessel" component={VesselRouter} />
                <Route path="/rotation" component={RotationRouter} />
                <Route path="/promotions" component={PromotionsRouter} />
                <Route path="/drugs-alcohol" component={DrugsAlcoholModule} />
                <Route path="/rest-hours/vessel/:vesselId/:month" component={RestHoursVesselOverviewComponent} />
                <Route path="/rest-hours/:rest*" component={RestHoursModuleComponent} />
                <Route path="/rest-hours" component={RestHoursModuleComponent} />
                <Route path="/reports" component={ReportsComingSoon} />
                <Route path="/admin/*" component={AdminRouter} />
                <Route path="/admin" component={AdminRouter} />
                <Route path="/accounts/:path*" component={AccountsModule} />
                <Route path="/accounts" component={AccountsModule} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
