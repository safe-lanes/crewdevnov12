import { lazy, Suspense } from 'react';
import { useCrewPoolVersion } from './hooks/useCrewPoolVersion';

const CrewPoolModuleLegacy = lazy(() => import('./CrewPoolModule').then(m => ({ default: m.CrewPoolModule })));
const CrewPoolModuleV2 = lazy(() => import('./v2/CrewPoolModule_v2').then(m => ({ default: m.CrewPoolModule_v2 })));

export function CrewPoolModuleRouter() {
  const { isV2 } = useCrewPoolVersion();

  return (
    <Suspense fallback={<div className="p-4">Loading Crew Pool...</div>}>
      {isV2 ? <CrewPoolModuleV2 /> : <CrewPoolModuleLegacy />}
    </Suspense>
  );
}

export { useCrewPoolVersion } from './hooks/useCrewPoolVersion';
export { CrewPoolModule } from './CrewPoolModule';
