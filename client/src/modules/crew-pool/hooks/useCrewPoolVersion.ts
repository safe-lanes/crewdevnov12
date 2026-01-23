import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'crew_pool_version';

export type CrewPoolVersion = 'legacy' | 'v2';

export function useCrewPoolVersion() {
  const [version, setVersionState] = useState<CrewPoolVersion>('legacy');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'v2' || stored === 'legacy') {
      setVersionState(stored);
    }
  }, []);

  const setVersion = useCallback((newVersion: CrewPoolVersion) => {
    localStorage.setItem(STORAGE_KEY, newVersion);
    setVersionState(newVersion);
  }, []);

  const toggleVersion = useCallback(() => {
    const newVersion = version === 'legacy' ? 'v2' : 'legacy';
    setVersion(newVersion);
  }, [version, setVersion]);

  return {
    version,
    setVersion,
    toggleVersion,
    isV2: version === 'v2',
    isLegacy: version === 'legacy',
  };
}
