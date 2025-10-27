import { useState } from 'react';
import MainLayout from '@/components/main/MainLayout';
import RestHoursSideBar from './RestHoursSideBar';
import { RestHoursDashboard } from './RestHoursDashboard';
import { RestHoursRecord } from './RestHoursRecord';
import { RestHoursPlan } from './RestHoursPlan';

export const RestHoursModule = (): JSX.Element => {
  const [selectedRestHoursPage, setSelectedRestHoursPage] = useState("dashboard");
  
  const allowedPages = ["dashboard", "record", "plan"];

  const renderContent = () => {
    switch (selectedRestHoursPage) {
      case "dashboard":
        return <RestHoursDashboard />;
      case "record":
        return <RestHoursRecord />;
      case "plan":
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
      <MainLayout>
        {renderContent()}
      </MainLayout>
    </>
  );
};
