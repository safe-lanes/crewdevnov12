import { useState, useEffect, useCallback } from 'react';
import { PromotionsModule } from './PromotionsModule';
import { PromotionsModule_v2 } from './v2/PromotionsModule_v2';

const STORAGE_KEY = 'promotions_module_version';
const VERSION_CHANGE_EVENT = 'promotions_version_change';
type PromotionsVersion = 'v1' | 'v2';

export function usePromotionsVersion() {
  const [version, setVersionState] = useState<PromotionsVersion>(() => {
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
      const customEvent = e as CustomEvent<PromotionsVersion>;
      if (customEvent.detail) {
        setVersionState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newVersion = e.newValue as PromotionsVersion;
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

  const setVersion = useCallback((newVersion: PromotionsVersion) => {
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

export default function PromotionsRouter() {
  const { isV2 } = usePromotionsVersion();

  if (isV2) {
    return <PromotionsModule_v2 />;
  }

  return <PromotionsModule />;
}
