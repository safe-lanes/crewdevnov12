import { useLocation } from 'wouter';
import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { NoAccessPage } from '@/components/ProtectedRoute';
import MainLayout from '@/components/main/MainLayout';
import RestHoursSideBar from './RestHoursSideBar';
import { RestHoursDashboard } from './components/RestHoursDashboard';
import { RestHoursRecord } from './components/RestHoursRecord';
import { RestHoursPlan } from './components/RestHoursPlan';
import { restHoursApiV2 } from './api/restHoursApiV2';

export const RestHoursModule = (): JSX.Element => {
  const [location, setLocation] = useLocation();
  
  const getPageFromLocation = () => {
    if (location.includes('/rest-hours/dashboard')) return 'dashboard';
    if (location.includes('/rest-hours/record')) return 'record';
    if (location.includes('/rest-hours/plan')) return 'plan';
    return 'dashboard';
  };
  
  const [selectedRestHoursPage, setSelectedRestHoursPageState] = useState(getPageFromLocation());
  
  useEffect(() => {
    setSelectedRestHoursPageState(getPageFromLocation());
  }, [location]);
  
  const { canView, permissions } = usePermissions();
  const allowedPages = useMemo(() => {
    const all = ["dashboard", "record", "plan"];
    if (permissions.length === 0) return all;
    const pageToMenu: Record<string, string> = { "dashboard": "Rest Hours Dashboard", "record": "Record", "plan": "Rest Hours Plan" };
    return all.filter(p => canView(pageToMenu[p] || p));
  }, [permissions, canView]);

  const setSelectedRestHoursPage = (page: string) => {
    switch (page) {
      case 'dashboard':
        setLocation('/rest-hours/dashboard');
        break;
      case 'record':
        setLocation('/rest-hours/record');
        break;
      case 'plan':
        setLocation('/rest-hours/plan');
        break;
    }
  };

  useEffect(() => {
    if (allowedPages.length > 0 && !allowedPages.includes(selectedRestHoursPage)) {
      setSelectedRestHoursPage(allowedPages[0]);
    }
  }, [selectedRestHoursPage, allowedPages]);

  const renderContent = () => {
    if (permissions.length > 0 && !allowedPages.includes(selectedRestHoursPage)) {
      return <NoAccessPage menuName="Rest Hours" />;
    }
    switch (selectedRestHoursPage) {
      case 'dashboard':
        return <RestHoursDashboard />;
      case 'record':
        return <RestHoursRecord />;
      case 'plan':
        return <RestHoursPlan />;
      default:
        return <RestHoursDashboard />;
    }
  };

  return (
    <div data-testid="rest-hours-container">
      <RestHoursSideBar 
        selectedRestHoursPage={selectedRestHoursPage}
        setSelectedRestHoursPage={setSelectedRestHoursPage}
        allowedPages={allowedPages}
      />
      <MainLayout hasSidebar={true}>
        {renderContent()}
      </MainLayout>
    </div>
  );
};

export { restHoursApiV2 };
