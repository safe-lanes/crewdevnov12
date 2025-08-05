import type { Express, Request, Response } from "express";
import type { NavigationItem, MenuItem, UserWithPermissions } from "@shared/schema";
import * as menuConfigModule from "../data/menu-config.json";
const menuConfig = menuConfigModule as any;

// Mock user data - in production this would come from authentication middleware
const mockUser: UserWithPermissions = {
  id: 1,
  username: "admin",
  password: "***",
  role: "admin",
  permissions: JSON.stringify([
    "view_dashboard",
    "view_crewing",
    "view_appraisals",
    "manage_crew",
    "view_technical",
    "view_maintenance",
    "view_equipment",
    "admin_access",
    "manage_users",
    "manage_forms",
    "system_settings",
    "view_reports"
  ]),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  effectivePermissions: [
    "view_dashboard",
    "view_crewing",
    "view_appraisals",
    "manage_crew",
    "view_technical",
    "view_maintenance",
    "view_equipment",
    "admin_access",
    "manage_users",
    "manage_forms",
    "system_settings",
    "view_reports"
  ]
};

interface NavigationConfig {
  menuItems: NavigationItem[];
  roles: Array<{
    name: string;
    description: string;
    permissions: string[];
  }>;
}

export function registerNavigationRoutes(app: Express) {
  // Get current user with permissions
  app.get('/api/auth/current-user', (req: Request, res: Response) => {
    try {
      // In production, this would get the user from session/token
      res.json(mockUser);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Get navigation menu items for the current user
  app.get('/api/navigation/menu-items', (req: Request, res: Response) => {
    try {
      const config = menuConfig as NavigationConfig;
      
      // Filter menu items based on user permissions
      const userPermissions = mockUser.effectivePermissions;
      const filteredItems = config.menuItems.filter(item => {
        if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
          return true;
        }
        
        return item.requiredPermissions.some(permission => 
          userPermissions.includes(permission)
        );
      });

      res.json(filteredItems);
    } catch (error) {
      console.error("Error fetching navigation items:", error);
      res.status(500).json({ error: "Failed to fetch navigation items" });
    }
  });

  // Get all available permissions
  app.get('/api/navigation/permissions', (req: Request, res: Response) => {
    try {
      const config = menuConfig as NavigationConfig;
      const allPermissions = new Set<string>();
      
      // Collect all permissions from roles
      config.roles.forEach(role => {
        role.permissions.forEach(permission => {
          allPermissions.add(permission);
        });
      });

      res.json(Array.from(allPermissions).sort());
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // Get all roles
  app.get('/api/navigation/roles', (req: Request, res: Response) => {
    try {
      const config = menuConfig as NavigationConfig;
      res.json(config.roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // Check if user has specific permissions
  app.post('/api/navigation/check-permissions', (req: Request, res: Response) => {
    try {
      const { permissions: requiredPermissions } = req.body;
      
      if (!Array.isArray(requiredPermissions)) {
        return res.status(400).json({ error: "Permissions must be an array" });
      }

      const userPermissions = mockUser.effectivePermissions;
      const hasPermission = requiredPermissions.some(permission => 
        userPermissions.includes(permission)
      );

      res.json({ hasPermission });
    } catch (error) {
      console.error("Error checking permissions:", error);
      res.status(500).json({ error: "Failed to check permissions" });
    }
  });

  // Update user permissions (admin only)
  app.patch('/api/navigation/user-permissions/:userId', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { permissions } = req.body;

      // Check if current user has admin access
      if (!mockUser.effectivePermissions.includes('admin_access')) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // In production, this would update the database
      console.log(`Would update permissions for user ${userId}:`, permissions);
      
      res.json({ success: true, message: "Permissions updated successfully" });
    } catch (error) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // Create new menu item (admin only)
  app.post('/api/navigation/menu-items', (req: Request, res: Response) => {
    try {
      const menuItem = req.body;

      // Check if current user has admin access
      if (!mockUser.effectivePermissions.includes('admin_access')) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // In production, this would save to database
      console.log("Would create menu item:", menuItem);
      
      res.status(201).json({ 
        success: true, 
        message: "Menu item created successfully",
        id: Date.now() // Mock ID
      });
    } catch (error) {
      console.error("Error creating menu item:", error);
      res.status(500).json({ error: "Failed to create menu item" });
    }
  });

  // Update menu item (admin only)
  app.patch('/api/navigation/menu-items/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check if current user has admin access
      if (!mockUser.effectivePermissions.includes('admin_access')) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // In production, this would update the database
      console.log(`Would update menu item ${id}:`, updates);
      
      res.json({ success: true, message: "Menu item updated successfully" });
    } catch (error) {
      console.error("Error updating menu item:", error);
      res.status(500).json({ error: "Failed to update menu item" });
    }
  });

  // Delete menu item (admin only)
  app.delete('/api/navigation/menu-items/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if current user has admin access
      if (!mockUser.effectivePermissions.includes('admin_access') || !mockUser.effectivePermissions.includes('system_settings')) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // In production, this would delete from database
      console.log(`Would delete menu item ${id}`);
      
      res.json({ success: true, message: "Menu item deleted successfully" });
    } catch (error) {
      console.error("Error deleting menu item:", error);
      res.status(500).json({ error: "Failed to delete menu item" });
    }
  });
}