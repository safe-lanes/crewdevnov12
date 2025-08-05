import React from "react";
import { Switch, Route } from "wouter";
import { useNavigation } from "@/hooks/useNavigation";
import ProtectedRoute from "@/components/navigation/ProtectedRoute";
import type { NavigationItem } from "@shared/schema";

// Component imports - using direct imports to avoid dynamic import issues
import Dashboard from "@/pages/Dashboard";
import { ElementCrewAppraisals } from "@/pages/ElementCrewAppraisals";
import CrewingModule from "@/pages/CrewingModule";
import CrewManagement from "@/pages/CrewManagement";
import TechnicalModule from "@/pages/TechnicalModule";
import MaintenanceModule from "@/pages/MaintenanceModule";
import EquipmentModule from "@/pages/EquipmentModule";
import AdminModule from "@/pages/AdminModule";
import UserManagement from "@/pages/UserManagement";
import { FormEditor } from "@/pages/FormEditor";
import SystemSettings from "@/pages/SystemSettings";
import ReportsModule from "@/pages/ReportsModule";
import ComponentDemo from "@/pages/ComponentDemo";
import MenuManagement from "@/pages/MenuManagement";

const ComponentMap = {
  Dashboard,
  ElementCrewAppraisals,
  CrewingModule,
  CrewManagement,
  TechnicalModule,
  MaintenanceModule,
  EquipmentModule,
  AdminModule,
  UserManagement,
  FormEditor,
  MenuManagement,
  SystemSettings,
  ReportsModule,
  ComponentDemo,
};

interface DynamicRouterProps {
  fallbackComponent?: React.ComponentType;
}

const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const NotFound: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Page Not Found
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        The page you're looking for doesn't exist or you don't have permission to access it.
      </p>
    </div>
  </div>
);

const RouteComponent: React.FC<{ item: NavigationItem }> = ({ item }) => {
  const componentName = item.component as keyof typeof ComponentMap;
  const Component = ComponentMap[componentName];

  if (!Component) {
    console.warn(`Component "${item.component}" not found for route "${item.path}"`);
    return <NotFound />;
  }

  return (
    <ProtectedRoute requiredPermissions={item.requiredPermissions || []}>
      <Component />
    </ProtectedRoute>
  );
};

export const DynamicRouter: React.FC<DynamicRouterProps> = ({
  fallbackComponent: FallbackComponent = NotFound,
}) => {
  const { navigationItems, isLoading } = useNavigation();

  if (isLoading) {
    return <LoadingFallback />;
  }

  // Flatten all navigation items including nested ones for routing
  const flattenRoutes = (items: NavigationItem[]): NavigationItem[] => {
    const result: NavigationItem[] = [];
    
    const flatten = (item: NavigationItem) => {
      result.push(item);
      if (item.children) {
        item.children.forEach(flatten);
      }
    };
    
    items.forEach(flatten);
    return result;
  };

  const allRoutes = flattenRoutes(navigationItems);

  return (
    <Switch>
      {allRoutes.map((item) => (
        <Route
          key={item.id}
          path={item.path}
          component={() => <RouteComponent item={item} />}
        />
      ))}
      
      {/* Static routes that don't depend on navigation config */}
      <Route
        path="/component-demo"
        component={ComponentMap.ComponentDemo}
      />
      
      {/* Fallback route */}
      <Route component={FallbackComponent} />
    </Switch>
  );
};

export default DynamicRouter;