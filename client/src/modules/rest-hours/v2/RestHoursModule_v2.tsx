import { useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import MainLayout from '@/components/main/MainLayout';
import RestHoursSideBar from '../RestHoursSideBar';
import { RestHoursDashboard } from './components/RestHoursDashboard';
import { RestHoursRecord } from './components/RestHoursRecord';
import { RestHoursPlan } from './components/RestHoursPlan';
import { restHoursApiV2 } from './api/restHoursApiV2';

export const RestHoursModule_v2 = (): JSX.Element => {
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
  
  const allowedPages = ["dashboard", "record", "plan"];

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

  const renderContent = () => {
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
    <div data-testid="rest-hours-v2-container">
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
