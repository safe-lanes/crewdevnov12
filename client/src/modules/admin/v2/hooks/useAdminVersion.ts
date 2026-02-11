import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'admin_module_version';
const VERSION_CHANGE_EVENT = 'admin_version_change';
const DEFAULT_VERSION = 'v1';

export type AdminVersion = 'v1' | 'v2';

export function useAdminVersion() {
  const [version, setVersionState] = useState<AdminVersion>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'v1' || stored === 'v2') {
        return stored;
      }
    } catch {}
    return DEFAULT_VERSION;
  });

  useEffect(() => {
    const handleVersionChange = (e: Event) => {
      const customEvent = e as CustomEvent<AdminVersion>;
      if (customEvent.detail) {
        setVersionState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newVersion = e.newValue as AdminVersion;
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

  const setVersion = useCallback((newVersion: AdminVersion) => {
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

  const isV2 = version === 'v2';

  return {
    version,
    setVersion,
    toggleVersion,
    isV2,
  };
}
