import { useState, useEffect } from 'react';
import VesselModule from './VesselModule';
import { VesselModule_v2 } from './v2/VesselModule_v2';

const STORAGE_KEY = 'vessel_module_version';
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
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch {}
  }, [version]);

  const setVersion = (newVersion: VesselVersion) => {
    setVersionState(newVersion);
  };

  const toggleVersion = () => {
    setVersionState(prev => prev === 'v1' ? 'v2' : 'v1');
  };

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
