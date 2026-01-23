import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'crew_pool_version';

export type CrewPoolVersion = 'legacy' | 'v2';

function getStoredVersion(): CrewPoolVersion {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'v2' ? 'v2' : 'legacy';
}

export function useCrewPoolVersion() {
  const [version, setVersionState] = useState<CrewPoolVersion>(getStoredVersion);

  const setVersion = useCallback((newVersion: CrewPoolVersion) => {
    localStorage.setItem(STORAGE_KEY, newVersion);
    setVersionState(newVersion);
  }, []);

  const toggleVersion = useCallback(() => {
    const currentVersion = getStoredVersion();
    const newVersion = currentVersion === 'legacy' ? 'v2' : 'legacy';
    localStorage.setItem(STORAGE_KEY, newVersion);
    setVersionState(newVersion);
  }, []);

  return {
    version,
    setVersion,
    toggleVersion,
    isV2: version === 'v2',
    isLegacy: version === 'legacy',
  };
}
