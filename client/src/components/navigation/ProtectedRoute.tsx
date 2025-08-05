import React from "react";
import { useNavigation, useCurrentUser } from "@/hooks/useNavigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  fallback,
}) => {
  const { hasPermission } = useNavigation();
  const currentUser = useCurrentUser();

  // Loading state
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check permissions
  if (requiredPermissions.length > 0 && !hasPermission(requiredPermissions)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this area. Please contact your administrator if you believe this is an error.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;