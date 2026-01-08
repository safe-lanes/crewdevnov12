import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import HeaderComponent from "./components/Navbar/HeaderComponent";

const AdminModule = lazy(() => import("./modules/admin/AdminModule").then(m => ({ default: m.AdminModule })));
const ElementCrewAppraisals = lazy(() => import("./modules/crewing/ElementCrewAppraisals").then(m => ({ default: m.ElementCrewAppraisals })));
const RecruitmentModule = lazy(() => import("./modules/recruitment/RecruitmentModule").then(m => ({ default: m.RecruitmentModule })));
const CrewPoolModule = lazy(() => import("./modules/crew-pool/CrewPoolModule").then(m => ({ default: m.CrewPoolModule })));
const VesselModule = lazy(() => import("./modules/vessel/VesselModule").then(m => ({ default: m.VesselModule })));
const RotationModule = lazy(() => import("./modules/rotation/RotationModule").then(m => ({ default: m.RotationModule })));
const PromotionsModule = lazy(() => import("./modules/promotions/PromotionsModule").then(m => ({ default: m.PromotionsModule })));
const DrugsAlcoholModule = lazy(() => import("./modules/drugs-alcohol/DrugsAlcoholModule").then(m => ({ default: m.DrugsAlcoholModule })));
const RestHoursModule = lazy(() => import("./modules/rest-hours/RestHoursModule").then(m => ({ default: m.RestHoursModule })));
const RestHoursVesselOverview = lazy(() => import("./modules/rest-hours/RestHoursVesselOverview").then(m => ({ default: m.RestHoursVesselOverview })));
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
                <Route path="/" component={ElementCrewAppraisals} />
                <Route path="/dashboard" component={DashboardPage} />
                <Route path="/recruitment" component={RecruitmentModule} />
                <Route path="/crew-pool" component={CrewPoolModule} />
                <Route path="/vessel" component={VesselModule} />
                <Route path="/rotation" component={RotationModule} />
                <Route path="/promotions" component={PromotionsModule} />
                <Route path="/drugs-alcohol" component={DrugsAlcoholModule} />
                <Route path="/rest-hours/vessel/:vesselId/:month" component={RestHoursVesselOverview} />
                <Route path="/rest-hours/:rest*" component={RestHoursModule} />
                <Route path="/rest-hours" component={RestHoursModule} />
                <Route path="/reports" component={ReportsComingSoon} />
                <Route path="/admin/*" component={AdminModule} />
                <Route path="/admin" component={AdminModule} />
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
