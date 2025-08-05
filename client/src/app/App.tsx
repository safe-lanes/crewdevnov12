import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route } from "wouter";
import { CrewingListPage } from "@/modules/crewing/pages/CrewingListPage";
import { CrewingAddPage } from "@/modules/crewing/pages/CrewingAddPage";
import { CrewingEditPage } from "@/modules/crewing/pages/CrewingEditPage";
import { AdminModule } from "@/modules/admin/pages/AdminModule";
import NotFound from "@/components/common/NotFound";
import { AppErrorBoundary } from "@/components/feedback/AppErrorBoundary";
import { PageLayout } from "@/components/layout/PageLayout";

const queryClient = new QueryClient();

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PageLayout>
            <Switch>
              <Route path="/" component={CrewingListPage} />
              <Route path="/crew/add" component={CrewingAddPage} />
              <Route path="/crew/edit/:id" component={CrewingEditPage} />
              <Route path="/admin" component={AdminModule} />
              <Route component={NotFound} />
            </Switch>
          </PageLayout>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;