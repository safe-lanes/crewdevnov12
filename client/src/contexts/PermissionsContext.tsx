import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDecryptedLocalStorageItem } from '@/lib/encryptionService';
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
  isLoading: boolean;
  canView: (menuName: string) => boolean;
  canCreate: (menuName: string) => boolean;
  canEdit: (menuName: string) => boolean;
  canDelete: (menuName: string) => boolean;
  canViewRoute: (route: string) => boolean;
  getVesselIds: () => string[];
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

function getUserProfile(): { role?: string; roleId?: string; myVessels?: MyVessel[] } | null {
  try {
    const raw = localStorage.getItem('userProfile');
    console.log('[Permissions DEBUG] Raw localStorage userProfile:', raw ? `${raw.substring(0, 80)}...` : 'null');

    const profile = getDecryptedLocalStorageItem('userProfile', true);
    console.log('[Permissions DEBUG] Decrypted profile:', profile);

    if (profile && typeof profile === 'object') {
      console.log('[Permissions DEBUG] Role:', profile.role, '| RoleId:', profile.roleId);
      return profile;
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          console.log('[Permissions DEBUG] Fallback: parsed as plain JSON. Role:', parsed.role, '| RoleId:', parsed.roleId);
          return parsed;
        }
      } catch {
        console.log('[Permissions DEBUG] Fallback: not valid JSON either');
      }
    }

    return null;
  } catch (err) {
    console.error('[Permissions DEBUG] getUserProfile error:', err);
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
  const myVessels = userProfile?.myVessels || [];

  console.log('[Permissions DEBUG] Query params - roleName:', roleName, '| roleId:', roleId, '| enabled:', !!(roleId || roleName));

  const { data, isLoading } = useQuery({
    queryKey: ['/api/v2/admin/access-control/my-permissions', roleId, roleName],
    queryFn: async () => {
      const result = await adminApiV2.getMyPermissions({
        roleId: roleId || undefined,
        roleName: roleName || undefined,
      });
      console.log('[Permissions DEBUG] API response - permissions count:', result?.permissions?.length, '| sample:', result?.permissions?.slice(0, 3));
      return result;
    },
    enabled: !!(roleId || roleName),
    staleTime: 5 * 60 * 1000,
    retry: 1,
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
    isLoading,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canViewRoute,
    getVesselIds,
  }), [permissions, myVessels, roleName, roleId, isLoading, canView, canCreate, canEdit, canDelete, canViewRoute, getVesselIds]);

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
