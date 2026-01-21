import { useState, useCallback } from 'react';

type RecruitmentVersion = 'legacy' | 'v2';

const STORAGE_KEY = 'recruitment_version';

export function useRecruitmentVersion() {
  const [version, setVersionState] = useState<RecruitmentVersion>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'v2' ? 'v2' : 'legacy') as RecruitmentVersion;
  });

  const setVersion = useCallback((newVersion: RecruitmentVersion) => {
    localStorage.setItem(STORAGE_KEY, newVersion);
    setVersionState(newVersion);
  }, []);

  const toggleVersion = useCallback(() => {
    const newVersion = version === 'legacy' ? 'v2' : 'legacy';
    setVersion(newVersion);
  }, [version, setVersion]);

  const isV2 = version === 'v2';
  const isLegacy = version === 'legacy';

  return {
    version,
    setVersion,
    toggleVersion,
    isV2,
    isLegacy,
  };
}

export function getRecruitmentVersion(): RecruitmentVersion {
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored === 'v2' ? 'v2' : 'legacy') as RecruitmentVersion;
}

export function setRecruitmentVersion(version: RecruitmentVersion): void {
  localStorage.setItem(STORAGE_KEY, version);
}
