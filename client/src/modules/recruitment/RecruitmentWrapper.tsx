import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const RecruitmentModuleV2 = lazy(() => import("./RecruitmentModule_v2").then(m => ({ default: m.RecruitmentModuleV2 })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function RecruitmentWrapper() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RecruitmentModuleV2 />
    </Suspense>
  );
}

export default RecruitmentWrapper;
