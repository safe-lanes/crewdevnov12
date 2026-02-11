import { useAdminVersion } from './v2/hooks/useAdminVersion';
import { AdminModule } from './AdminModule';
import { AdminModule_v2 } from './v2/AdminModule';

export default function AdminRouter() {
  const { isV2 } = useAdminVersion();

  if (isV2) {
    return <AdminModule_v2 />;
  }

  return <AdminModule />;
}

export { AdminModule };
export { AdminModule_v2 } from './v2/AdminModule';
export { useAdminVersion } from './v2/hooks/useAdminVersion';
