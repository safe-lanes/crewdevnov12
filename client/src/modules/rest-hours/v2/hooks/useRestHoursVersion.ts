import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rest_hours_module_version';
const DEFAULT_VERSION = 'v1';

export type RestHoursVersion = 'v1' | 'v2';

export function useRestHoursVersion() {
  const [version, setVersionState] = useState<RestHoursVersion>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'v1' || stored === 'v2') {
        return stored;
      }
    } catch {}
    return DEFAULT_VERSION;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch {}
  }, [version]);

  const setVersion = useCallback((newVersion: RestHoursVersion) => {
    setVersionState(newVersion);
  }, []);

  const toggleVersion = useCallback(() => {
    setVersionState(prev => prev === 'v1' ? 'v2' : 'v1');
  }, []);

  const isV2 = version === 'v2';

  return {
    version,
    setVersion,
    toggleVersion,
    isV2,
  };
}

export function getRestHoursVersion(): RestHoursVersion {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'v1' || stored === 'v2') {
      return stored;
    }
  } catch {}
  return DEFAULT_VERSION;
}

export function setRestHoursVersion(version: RestHoursVersion): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {}
}
