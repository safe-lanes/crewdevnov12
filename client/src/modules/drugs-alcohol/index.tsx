import { DrugsAlcoholModule } from './DrugsAlcoholModule';
import { DrugsAlcoholModule_v2 } from './v2/DrugsAlcoholModule_v2';
import { useDrugsAlcoholVersion } from './v2/hooks/useDrugsAlcoholVersion';

export { useDrugsAlcoholVersion };

export function DrugsAlcoholModuleRouter() {
  const { isV2 } = useDrugsAlcoholVersion();
  if (isV2) return <DrugsAlcoholModule_v2 />;
  return <DrugsAlcoholModule />;
}

export { DrugsAlcoholModule };
export { DrugsAlcoholModule_v2 };
