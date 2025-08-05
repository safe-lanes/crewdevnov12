import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import { ElementCrewAppraisals } from "./pages/ElementCrewAppraisals";
import ComponentDemo from "./pages/ComponentDemo";
import { DynamicRouter } from "@/components/routing/DynamicRouter";
import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
});

function App() {
  // Check if we're running in micro frontend mode
  const isMicroFrontend = typeof window !== 'undefined' && 
    (window as any).__MICRO_FRONTEND_MODE__;

  if (isMicroFrontend) {
    // In micro frontend mode, use simple routing without layout
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={ElementCrewAppraisals} />
            <Route path="/component-demo" component={ComponentDemo} />
            <Route component={ElementCrewAppraisals} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Standalone mode with dynamic routing and layout
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLayout>
          <DynamicRouter />
        </AppLayout>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;