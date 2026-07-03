import { usePermissions } from '@/contexts/PermissionsContext';
import { ShieldX } from 'lucide-react';
import { Redirect } from 'wouter';

interface ProtectedRouteProps {
  menuName: string;
  children: React.ReactNode;
  /**
   * Optional route to redirect to when the user lacks View permission on
   * `menuName`. If omitted, the standard "Access Restricted" page renders.
   * Used by the Dashboard route to fall back to Recruitment instead of
   * showing the no-access screen on the default landing page.
   */
  fallbackRoute?: string;
}

export function ProtectedRoute({ menuName, children, fallbackRoute }: ProtectedRouteProps) {
  const { canView, isLoading, permissions } = usePermissions();

  if (isLoading) return null;

  if (permissions.length > 0 && !canView(menuName)) {
    if (fallbackRoute) {
      return <Redirect to={fallbackRoute} />;
    }
    return <NoAccessPage menuName={menuName} />;
  }

  return <>{children}</>;
}

export function NoAccessPage({ menuName }: { menuName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-center px-4" data-testid="no-access-page">
      <ShieldX size={64} className="text-gray-300 mb-4" />
      <h2 className="text-xl font-semibold text-gray-700 mb-2" data-testid="text-no-access-title">
        Access Restricted
      </h2>
      <p className="text-sm text-gray-500 max-w-md" data-testid="text-no-access-message">
        You do not have permission to access the <strong>{menuName}</strong> module.
        Please contact your administrator to request access.
      </p>
    </div>
  );
}
