import { Switch, Route } from "wouter";
import { CrewingListPage } from "@/modules/crewing/pages/CrewingListPage";
import { CrewingAddPage } from "@/modules/crewing/pages/CrewingAddPage";
import { CrewingEditPage } from "@/modules/crewing/pages/CrewingEditPage";
import { AdminModule } from "@/modules/admin/pages/AdminModule";
import NotFound from "@/components/common/NotFound";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={CrewingListPage} />
      <Route path="/crew/add" component={CrewingAddPage} />
      <Route path="/crew/edit/:id" component={CrewingEditPage} />
      <Route path="/admin" component={AdminModule} />
      <Route component={NotFound} />
    </Switch>
  );
}