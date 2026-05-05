import { useLocation } from 'wouter';
import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import MainLayout from '@/components/main/MainLayout';
import TrainingRetentionSideBar from './TrainingRetentionSideBar';
import { Training } from './components/Training';
import { Retention } from './components/Retention';

export const TrainingRetentionModule = (): JSX.Element => {
  const [location, setLocation] = useLocation();

  const getPageFromLocation = () => {
    if (location.includes('/training-retention/training')) return 'training';
    if (location.includes('/training-retention/retention')) return 'retention';
    return 'training';
  };

  const [selectedPage, setSelectedPageState] = useState(getPageFromLocation());

  useEffect(() => {
    setSelectedPageState(getPageFromLocation());
  }, [location]);

  const { canView, permissions } = usePermissions();
  const allowedPages = useMemo(() => {
    const all = ["training", "retention"];
    if (permissions.length === 0) return all;
    const pageToMenu: Record<string, string> = { "training": "Training", "retention": "Retention" };
    return all.filter(p => canView(pageToMenu[p] || p));
  }, [permissions, canView]);

  const setSelectedPage = (page: string) => {
    switch (page) {
      case 'training':
        setLocation('/training-retention/training');
        break;
      case 'retention':
        setLocation('/training-retention/retention');
        break;
    }
  };

  useEffect(() => {
    if (allowedPages.length > 0 && !allowedPages.includes(selectedPage)) {
      setSelectedPage(allowedPages[0]);
    }
  }, [selectedPage, allowedPages]);

  const renderContent = () => {
    if (permissions.length > 0 && !allowedPages.includes(selectedPage)) {
      return null;
    }
    switch (selectedPage) {
      case 'training':
        return <Training />;
      case 'retention':
        return <Retention />;
      default:
        return <Training />;
    }
  };

  return (
    <div data-testid="training-retention-container">
      <TrainingRetentionSideBar
        selectedPage={selectedPage}
        setSelectedPage={setSelectedPage}
        allowedPages={allowedPages}
      />
      <MainLayout hasSidebar={true}>
        {renderContent()}
      </MainLayout>
    </div>
  );
};
