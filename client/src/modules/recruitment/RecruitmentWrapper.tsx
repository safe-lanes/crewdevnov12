import { lazy, Suspense, useState, useEffect } from 'react';
import { Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const LegacyRecruitmentModule = lazy(() => import("./RecruitmentModule").then(m => ({ default: m.RecruitmentModule })));
const RecruitmentModuleV2 = lazy(() => import("../recruitment-v2/RecruitmentModule_v2").then(m => ({ default: m.RecruitmentModuleV2 })));

type RecruitmentVersion = 'legacy' | 'v2';
const STORAGE_KEY = 'recruitment_version';

function getStoredVersion(): RecruitmentVersion {
  const stored = localStorage.getItem(STORAGE_KEY);
  return (stored === 'v2' ? 'v2' : 'legacy') as RecruitmentVersion;
}

function setStoredVersion(version: RecruitmentVersion): void {
  localStorage.setItem(STORAGE_KEY, version);
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function RecruitmentWrapper() {
  const [version, setVersion] = useState<RecruitmentVersion>(getStoredVersion);

  const toggleVersion = () => {
    const newVersion = version === 'legacy' ? 'v2' : 'legacy';
    setStoredVersion(newVersion);
    setVersion(newVersion);
  };

  return (
    <div className="relative h-full">
      <div className="absolute top-14 right-2 z-50 flex items-center gap-2 bg-white/90 rounded-lg p-1 shadow-sm border">
        <Badge 
          variant={version === 'legacy' ? 'default' : 'outline'} 
          className={version === 'legacy' ? 'bg-gray-500' : ''}
          data-testid="badge-version-indicator"
        >
          {version === 'legacy' ? 'Legacy' : 'V2'}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleVersion}
          className="h-7 text-xs"
          data-testid="button-toggle-recruitment-version"
        >
          {version === 'legacy' ? (
            <>
              <ToggleLeft className="h-4 w-4 mr-1" />
              Switch to V2
            </>
          ) : (
            <>
              <ToggleRight className="h-4 w-4 mr-1" />
              Switch to Legacy
            </>
          )}
        </Button>
      </div>

      <Suspense fallback={<PageLoader />}>
        {version === 'v2' ? (
          <RecruitmentModuleV2 />
        ) : (
          <LegacyRecruitmentModule />
        )}
      </Suspense>
    </div>
  );
}

export default RecruitmentWrapper;
