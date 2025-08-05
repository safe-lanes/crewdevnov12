import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import { CrewingListPage } from "./modules/crewing";
import { AdminModule } from "./modules/admin";
import NotFound from "./pages/not-found";
import { useMicroFrontendConfig } from "./micro-frontend/MicroFrontendWrapper";

const queryClient = new QueryClient();

function App() {
  // Check if we're running in micro frontend mode
  const isMicroFrontend = typeof window !== 'undefined' && 
    (window as any).__MICRO_FRONTEND_MODE__;

  if (isMicroFrontend) {
    // In micro frontend mode, still need QueryClientProvider for AdminModule
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={CrewingListPage} />
            <Route path="/admin" component={AdminModule} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Standalone mode with full providers
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/" component={CrewingListPage} />
          <Route path="/admin" component={AdminModule} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;