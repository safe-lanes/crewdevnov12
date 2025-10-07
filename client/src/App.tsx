import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import NotFound from "./modules/not-found";
import { AdminModule } from "./modules/admin/AdminModule";
import { ElementCrewAppraisals } from "./modules/crewing/ElementCrewAppraisals";
import { RecruitmentModule } from "./modules/recruitment/RecruitmentModule";
import { CrewPoolModule } from "./modules/crew-pool/CrewPoolModule";
import { VesselModule } from "./modules/vessel/VesselModule";
import { RotationModule } from "./modules/rotation/RotationModule";
import { PromotionsModule } from "./modules/promotions/PromotionsModule";
import { DashboardPage } from "./pages/DashboardPage";
import HeaderComponent from "./components/Navbar/HeaderComponent";


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-transparent flex flex-row justify-center w-full">
          <div className="overflow-hidden bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%]  h-[900px] w-full">
            <HeaderComponent />
            <Switch>
              <Route path="/" component={ElementCrewAppraisals} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/recruitment" component={RecruitmentModule} />
              <Route path="/crew-pool" component={CrewPoolModule} />
              <Route path="/vessel" component={VesselModule} />
              <Route path="/rotation" component={RotationModule} />
              <Route path="/promotions" component={PromotionsModule} />
              <Route path="/admin/*" component={AdminModule} />
              <Route path="/admin" component={AdminModule} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;