import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import NotFound from "./modules/not-found";
import { AdminModule } from "./modules/admin/AdminModule";
import { ElementCrewAppraisals } from "./modules/crewing/ElementCrewAppraisals";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="bg-transparent flex flex-row justify-center w-full">
          <div className="overflow-hidden bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%]  h-[900px] w-full">
            <Switch>
              <Route path="/" component={ElementCrewAppraisals} />
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