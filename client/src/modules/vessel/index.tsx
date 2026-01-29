import { useState, useEffect, useCallback } from 'react';
import { VesselModule } from './VesselModule';
import { VesselModule_v2 } from './v2/VesselModule_v2';

const STORAGE_KEY = 'vessel_module_version';
const VERSION_CHANGE_EVENT = 'vessel_version_change';
type VesselVersion = 'v1' | 'v2';

export function useVesselVersion() {
  const [version, setVersionState] = useState<VesselVersion>(() => {
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
      const customEvent = e as CustomEvent<VesselVersion>;
      if (customEvent.detail) {
        setVersionState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newVersion = e.newValue as VesselVersion;
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

  const setVersion = useCallback((newVersion: VesselVersion) => {
    try {
      localStorage.setItem(STORAGE_KEY, newVersion);
    } catch {}
    setVersionState(newVersion);
    window.dispatchEvent(new CustomEvent(VERSION_CHANGE_EVENT, { detail: newVersion }));
  }, []);

  const toggleVersion = useCallback(() => {
    setVersionState(prev => {
      const newVersion = prev === 'v1' ? 'v2' : 'v1';
      try {
        localStorage.setItem(STORAGE_KEY, newVersion);
      } catch {}
      window.dispatchEvent(new CustomEvent(VERSION_CHANGE_EVENT, { detail: newVersion }));
      return newVersion;
    });
  }, []);

  return {
    version,
    setVersion,
    toggleVersion,
    isV2: version === 'v2',
  };
}

export default function VesselRouter() {
  const { isV2 } = useVesselVersion();
  
  if (isV2) {
    return <VesselModule_v2 />;
  }
  
  return <VesselModule />;
}

export { VesselModule, VesselModule_v2 };
