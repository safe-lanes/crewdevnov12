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
  userType: string | null;
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
    const profile = getDecryptedLocalStorageItem('userProfile', true);
    if (profile != null) {
      const extracted = safeExtractFields(profile);
      if (extracted) return extracted;
    }

    const raw = localStorage.getItem('userProfile');
    if (!raw) return null;

    const fromRaw = safeExtractFields(raw);
    if (fromRaw) return fromRaw;

    if (secretKeyAvailable()) {
      const decryptedStr = getDecryptedRawString('userProfile');
      if (decryptedStr) {
        const fromDecrypted = safeExtractFields(decryptedStr);
        if (fromDecrypted) return fromDecrypted;
      }
    }

    return null;
  } catch (err) {
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
  const userType = userProfile?.userType || null;
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

  const warnUnknownMenu = useCallback((menuName: string, action: string) => {
    if (permMap.size > 0 && !permMap.has(menuName.toLowerCase())) {
      console.warn(`[RBAC] ${action}("${menuName}") - menu not found in permissions, defaulting to allow`);
    }
  }, [permMap]);

  const canView = useCallback((menuName: string) => {
    if (!menuName) return true;
    warnUnknownMenu(menuName, 'canView');
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.canview;
  }, [permMap, warnUnknownMenu]);

  const canCreate = useCallback((menuName: string) => {
    if (!menuName) return true;
    warnUnknownMenu(menuName, 'canCreate');
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.cancreate;
  }, [permMap, warnUnknownMenu]);

  const canEdit = useCallback((menuName: string) => {
    if (!menuName) return true;
    warnUnknownMenu(menuName, 'canEdit');
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.canedit;
  }, [permMap, warnUnknownMenu]);

  const canDelete = useCallback((menuName: string) => {
    if (!menuName) return true;
    warnUnknownMenu(menuName, 'canDelete');
    const perm = permMap.get(menuName.toLowerCase());
    if (!perm) return true;
    return perm.candelete;
  }, [permMap, warnUnknownMenu]);

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
    userType,
    isLoading,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canViewRoute,
    getVesselIds,
  }), [permissions, myVessels, roleName, roleId, userId, userType, isLoading, canView, canCreate, canEdit, canDelete, canViewRoute, getVesselIds]);

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
