import { useRotationVersion } from './hooks/useRotationVersion';
import { RotationModule } from './RotationModule';
import { RotationModule_v2 } from './v2/RotationModule_v2';

export default function RotationRouter() {
  const { isV2 } = useRotationVersion();
  
  if (isV2) {
    return <RotationModule_v2 />;
  }
  
  return <RotationModule />;
}

export { RotationModule };
export { RotationModule_v2 } from './v2/RotationModule_v2';
export { useRotationVersion } from './hooks/useRotationVersion';
