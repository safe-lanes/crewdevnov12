import { useState, useEffect, useCallback } from 'react';
import { RestHoursModule } from './RestHoursModule';
import { RestHoursModule_v2 } from './v2/RestHoursModule_v2';
import { RestHoursVesselOverview as RestHoursVesselOverviewV1 } from './RestHoursVesselOverview';
import { RestHoursVesselOverview as RestHoursVesselOverviewV2 } from './v2/components/RestHoursVesselOverview';

const STORAGE_KEY = 'rest_hours_module_version';
const VERSION_CHANGE_EVENT = 'rest_hours_version_change';
type RestHoursVersion = 'v1' | 'v2';

export function useRestHoursVersion() {
  const [version, setVersionState] = useState<RestHoursVersion>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'v1' || stored === 'v2') {
        return stored;
      }
    } catch {}
    return 'v1';
  });

  useEffect(() => {
    const handleVersionChange = (e: Event) => {
      const customEvent = e as CustomEvent<RestHoursVersion>;
      if (customEvent.detail) {
        setVersionState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newVersion = e.newValue as RestHoursVersion;
        if (newVersion === 'v1' || newVersion === 'v2') {
          setVersionState(newVersion);
        }
      }
    };

    window.addEventListener(VERSION_CHANGE_EVENT, handleVersionChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(VERSION_CHANGE_EVENT, handleVersionChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setVersion = useCallback((newVersion: RestHoursVersion) => {
    try {
      localStorage.setItem(STORAGE_KEY, newVersion);
    } catch {}
    setVersionState(newVersion);
    window.dispatchEvent(
      new CustomEvent(VERSION_CHANGE_EVENT, { detail: newVersion })
    );
  }, []);

  const toggleVersion = useCallback(() => {
    setVersion(version === 'v1' ? 'v2' : 'v1');
  }, [version, setVersion]);

  return {
    version,
    setVersion,
    toggleVersion,
    isV2: version === 'v2',
  };
}

export function RestHoursModuleRouter() {
  const { isV2 } = useRestHoursVersion();

  if (isV2) {
    return <RestHoursModule_v2 />;
  }

  return <RestHoursModule />;
}

export function RestHoursVesselOverviewRouter() {
  const { isV2 } = useRestHoursVersion();

  if (isV2) {
    return <RestHoursVesselOverviewV2 />;
  }

  return <RestHoursVesselOverviewV1 />;
}

export { RestHoursModule };
export { RestHoursModule_v2 } from './v2/RestHoursModule_v2';
export { RestHoursVesselOverviewV1, RestHoursVesselOverviewV2 };
