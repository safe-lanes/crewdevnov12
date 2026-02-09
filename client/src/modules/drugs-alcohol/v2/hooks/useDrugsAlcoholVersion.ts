import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'drugs_alcohol_module_version';
const VERSION_CHANGE_EVENT = 'drugs_alcohol_version_change';
type DrugsAlcoholVersion = 'v1' | 'v2';

export function useDrugsAlcoholVersion() {
  const [version, setVersionState] = useState<DrugsAlcoholVersion>(() => {
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
      const customEvent = e as CustomEvent<DrugsAlcoholVersion>;
      if (customEvent.detail) {
        setVersionState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newVersion = e.newValue as DrugsAlcoholVersion;
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

  const setVersion = useCallback((newVersion: DrugsAlcoholVersion) => {
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
