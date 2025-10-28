import { Route, Switch, useLocation } from 'wouter';
import MainLayout from '@/components/main/MainLayout';
import RestHoursSideBar from './RestHoursSideBar';
import { RestHoursDashboard } from './RestHoursDashboard';
import { RestHoursRecord } from './RestHoursRecord';
import { RestHoursPlan } from './RestHoursPlan';
import { RestHoursVesselOverview } from './RestHoursVesselOverview';

export const RestHoursModule = (): JSX.Element => {
  const [location, setLocation] = useLocation();
  
  // Determine selected page based on route
  const selectedRestHoursPage = location.includes('/rest-hours/dashboard') 
    ? 'dashboard' 
    : location.includes('/rest-hours/plan') 
    ? 'plan' 
    : location.includes('/rest-hours/record') 
    ? 'record'
    : 'dashboard';
  
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

  return (
    <>
      <RestHoursSideBar 
        selectedRestHoursPage={selectedRestHoursPage}
        setSelectedRestHoursPage={setSelectedRestHoursPage}
        allowedPages={allowedPages}
      />
      <MainLayout>
        <Switch>
          <Route path="/rest-hours/dashboard" component={RestHoursDashboard} />
          <Route path="/rest-hours/record" component={RestHoursRecord} />
          <Route path="/rest-hours/plan" component={RestHoursPlan} />
          <Route path="/rest-hours/vessel/:vesselId/:month" component={RestHoursVesselOverview} />
          <Route path="/rest-hours" component={RestHoursDashboard} />
        </Switch>
      </MainLayout>
    </>
  );
};
