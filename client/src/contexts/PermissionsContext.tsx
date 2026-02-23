import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDecryptedLocalStorageItem, secretKeyAvailable, getDecryptedRawString, safeExtractFields } from '@/lib/encryptionService';
import type { ExtractedUserProfile } from '@/lib/encryptionService';
import { adminApiV2 } from '@/modules/admin/api/adminApiV2';

interface MenuPermission {
  menuName: string;
  displayName: string | null;
  route: string;
  parentMenu: string | null;
  canview: boolean;
  cancreate: boolean;
  canedit: boolean;
  candelete: boolean;
}

interface MyVessel {
  vessel: string;
  vesselId: string;
  imoNumber: string;
}

interface PermissionsContextType {
  permissions: MenuPermission[];
  myVessels: MyVessel[];
  roleName: string | null;
  roleId: string | null;
  userId: string | null;
  isLoading: boolean;
  canView: (menuName: string) => boolean;
  canCreate: (menuName: string) => boolean;
  canEdit: (menuName: string) => boolean;
  canDelete: (menuName: string) => boolean;
  canViewRoute: (route: string) => boolean;
  getVesselIds: () => string[];
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

function getUserProfile(): ExtractedUserProfile | null {
  try {
    console.log('[RBAC] getUserProfile: starting extraction...');
    console.log('[RBAC] secretKeyAvailable:', secretKeyAvailable());

    const profile = getDecryptedLocalStorageItem('userProfile', true);
    console.log('[RBAC] Stage 1 - decryptedLocalStorage result:', profile != null ? `type=${typeof profile}` : 'null');
    if (profile != null) {
      const extracted = safeExtractFields(profile);
      console.log('[RBAC] Stage 1 - safeExtractFields result:', extracted);
      if (extracted) return extracted;
    }

    const raw = localStorage.getItem('userProfile');
    console.log('[RBAC] Stage 2 - raw localStorage:', raw ? `length=${raw.length}, first50=${raw.substring(0, 50)}...` : 'null/empty');
    if (!raw) return null;

    const fromRaw = safeExtractFields(raw);
    console.log('[RBAC] Stage 2 - safeExtractFields(raw) result:', fromRaw);
    if (fromRaw) return fromRaw;

    if (secretKeyAvailable()) {
      const decryptedStr = getDecryptedRawString('userProfile');
      console.log('[RBAC] Stage 3 - getDecryptedRawString result:', decryptedStr ? `length=${decryptedStr.length}, first50=${decryptedStr.substring(0, 50)}...` : 'null');
      if (decryptedStr) {
        const fromDecrypted = safeExtractFields(decryptedStr);
        console.log('[RBAC] Stage 3 - safeExtractFields result:', fromDecrypted);
        if (fromDecrypted) return fromDecrypted;
      }
    }

    console.log('[RBAC] All stages failed - returning null');
    return null;
  } catch (err) {
    console.error('[RBAC] getUserProfile error:', err);
    return null;
  }
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<ReturnType<typeof getUserProfile>>(null);

  useEffect(() => {
    setUserProfile(getUserProfile());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'userProfile') {
        setUserProfile(getUserProfile());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const roleName = userProfile?.role || null;
  const roleId = userProfile?.roleId || null;
  const userId = userProfile?.userId || null;
  const myVessels = userProfile?.myVessels || [];

  const { data, isLoading } = useQuery({
    queryKey: ['/api/v2/admin/access-control/my-permissions', roleId, roleName],
    queryFn: async () => {
      const result = await adminApiV2.getMyPermissions({
        roleId: roleId || undefined,
        roleName: roleName || undefined,
      });
      return result;
    },
    enabled: !!(roleId || roleName),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const permissions: MenuPermission[] = data?.permissions || [];

  const permMap = useMemo(() => {
    const map = new Map<string, MenuPermission>();
    for (const p of permissions) {
      map.set(p.menuName.toLowerCase(), p);
      if (p.route) map.set(p.route.toLowerCase(), p);
    }
    return map;
  }, [permissions]);

  const canView = useCallback((menuName: string) => {
    if (!menuName) return true;
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.canview;
  }, [permMap]);

  const canCreate = useCallback((menuName: string) => {
    if (!menuName) return true;
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.cancreate;
  }, [permMap]);

  const canEdit = useCallback((menuName: string) => {
    if (!menuName) return true;
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.canedit;
  }, [permMap]);

  const canDelete = useCallback((menuName: string) => {
    if (!menuName) return true;
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.candelete;
  }, [permMap]);

  const canViewRoute = useCallback((route: string) => {
    if (!route) return true;
    const normalizedRoute = route.toLowerCase();
    const perm = permMap.get(normalizedRoute);
    if (perm) return perm.canview;
    for (const [key, p] of permMap.entries()) {
      if (key.startsWith('/') && normalizedRoute.startsWith(key)) {
        return p.canview;
      }
    }
    return true;
  }, [permMap]);

  const getVesselIds = useCallback(() => {
    return myVessels.map(v => v.vesselId);
  }, [myVessels]);

  const value = useMemo(() => ({
    permissions,
    myVessels,
    roleName,
    roleId,
    userId,
    isLoading,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canViewRoute,
    getVesselIds,
  }), [permissions, myVessels, roleName, roleId, userId, isLoading, canView, canCreate, canEdit, canDelete, canViewRoute, getVesselIds]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
