import { useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import MainLayout from '@/components/main/MainLayout';
import RestHoursSideBar from './RestHoursSideBar';
import { RestHoursDashboard } from './RestHoursDashboard';
import { RestHoursRecord } from './RestHoursRecord';
import { RestHoursPlan } from './RestHoursPlan';

export const RestHoursModule = (): JSX.Element => {
  const [location, setLocation] = useLocation();
  
  // Determine selected page based on route
  const getPageFromLocation = () => {
    if (location.includes('/rest-hours/dashboard')) return 'dashboard';
    if (location.includes('/rest-hours/record')) return 'record';
    if (location.includes('/rest-hours/plan')) return 'plan';
    return 'dashboard';
  };
  
  const [selectedRestHoursPage, setSelectedRestHoursPageState] = useState(getPageFromLocation());
  
  // Update selected page when location changes
  useEffect(() => {
    setSelectedRestHoursPageState(getPageFromLocation());
  }, [location]);
  
  const allowedPages = ["dashboard", "record", "plan"];

  const setSelectedRestHoursPage = (page: string) => {
    // Navigate using wouter's setLocation
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
    <>
      <RestHoursSideBar 
        selectedRestHoursPage={selectedRestHoursPage}
        setSelectedRestHoursPage={setSelectedRestHoursPage}
        allowedPages={allowedPages}
      />
      <MainLayout hasSidebar={true}>
        {renderContent()}
      </MainLayout>
    </>
  );
};
