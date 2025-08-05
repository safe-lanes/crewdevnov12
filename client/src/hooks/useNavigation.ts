import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import type { NavigationItem, UserWithPermissions } from "@shared/schema";

interface UseNavigationReturn {
  navigationItems: NavigationItem[];
  isLoading: boolean;
  error: Error | null;
  hasPermission: (permissions: string[]) => boolean;
  getNavigationTree: () => NavigationItem[];
  refreshNavigation: () => void;
}

export function useNavigation(): UseNavigationReturn {
  const queryClient = useQueryClient();
  
  // Fetch menu items from API
  const { data: menuItems = [], isLoading, error } = useQuery({
    queryKey: ['/api/navigation/menu-items'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/current-user'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const hasPermission = (requiredPermissions: string[]): boolean => {
    if (!currentUser || !requiredPermissions.length) return true;
    
    return requiredPermissions.some(permission => 
      currentUser.effectivePermissions.includes(permission)
    );
  };

  const filteredMenuItems = useMemo(() => {
    if (!currentUser) return [];
    
    return menuItems.filter(item => {
      const permissions = item.requiredPermissions || [];
      return hasPermission(permissions);
    });
  }, [menuItems, currentUser]);

  const getNavigationTree = (): NavigationItem[] => {
    const itemsMap = new Map<number, NavigationItem>();
    const rootItems: NavigationItem[] = [];

    // Create a map of all items and initialize children arrays
    filteredMenuItems.forEach(item => {
      itemsMap.set(item.id, { ...item, children: [] });
    });

    // Build the tree structure
    filteredMenuItems.forEach(item => {
      const treeItem = itemsMap.get(item.id)!;
      
      if (item.parentId && itemsMap.has(item.parentId)) {
        const parent = itemsMap.get(item.parentId)!;
        parent.children!.push(treeItem);
      } else {
        rootItems.push(treeItem);
      }
    });

    // Sort items by sortOrder
    const sortItems = (items: NavigationItem[]) => {
      items.sort((a, b) => a.sortOrder - b.sortOrder);
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortItems(item.children);
        }
      });
    };

    sortItems(rootItems);
    return rootItems;
  };

  const refreshNavigation = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/navigation/menu-items'] });
    queryClient.invalidateQueries({ queryKey: ['/api/auth/current-user'] });
  };

  return {
    navigationItems: filteredMenuItems,
    isLoading,
    error,
    hasPermission,
    getNavigationTree,
    refreshNavigation,
  };
}

export function useCurrentUser(): UserWithPermissions | undefined {
  const { data } = useQuery({
    queryKey: ['/api/auth/current-user'],
    staleTime: 10 * 60 * 1000,
  });

  return data;
}