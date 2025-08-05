import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { NavigationItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface MenuItemForm {
  title: string;
  path: string;
  icon: string;
  parentId?: number;
  sortOrder: number;
  isActive: boolean;
  requiredPermissions: string[];
  component: string;
}

const MenuManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<NavigationItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<MenuItemForm>({
    title: "",
    path: "",
    icon: "",
    sortOrder: 0,
    isActive: true,
    requiredPermissions: [],
    component: "",
  });

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['/api/navigation/menu-items'],
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['/api/navigation/permissions'],
  });

  const createMutation = useMutation({
    mutationFn: (data: MenuItemForm) => apiRequest('/api/navigation/menu-items', 'POST', data),
    onSuccess: () => {
      toast({ title: "Success", description: "Menu item created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/navigation/menu-items'] });
      setIsCreating(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create menu item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MenuItemForm> }) => 
      apiRequest(`/api/navigation/menu-items/${id}`, 'PATCH', data),
    onSuccess: () => {
      toast({ title: "Success", description: "Menu item updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/navigation/menu-items'] });
      setEditingItem(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update menu item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/navigation/menu-items/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: "Success", description: "Menu item deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/navigation/menu-items'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete menu item", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      path: "",
      icon: "",
      sortOrder: 0,
      isActive: true,
      requiredPermissions: [],
      component: "",
    });
  };

  const handleEdit = (item: NavigationItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      path: item.path,
      icon: item.icon || "",
      parentId: item.parentId,
      sortOrder: item.sortOrder,
      isActive: true, // Assuming active since it's in the list
      requiredPermissions: item.requiredPermissions || [],
      component: item.component || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
    setIsCreating(false);
    resetForm();
  };

  const iconOptions = Object.keys(LucideIcons).filter(name => 
    name !== 'default' && typeof (LucideIcons as any)[name] === 'function'
  ).sort();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Menu Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configure navigation menus and access control
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={isCreating || editingItem}>
          <Plus className="w-4 h-4 mr-2" />
          Add Menu Item
        </Button>
      </div>

      {(isCreating || editingItem) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingItem ? 'Edit Menu Item' : 'Create Menu Item'}</CardTitle>
            <CardDescription>
              Configure the menu item properties and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Menu item title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="path">Path</Label>
                  <Input
                    id="path"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    placeholder="/path/to/page"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="icon">Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(value) => setFormData({ ...formData, icon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.slice(0, 50).map((iconName) => (
                        <SelectItem key={iconName} value={iconName}>
                          {iconName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="component">Component</Label>
                  <Input
                    id="component"
                    value={formData.component}
                    onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                    placeholder="ComponentName"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="parentId">Parent Menu Item</Label>
                  <Select
                    value={formData.parentId?.toString() || ""}
                    onValueChange={(value) => setFormData({ ...formData, parentId: value ? parseInt(value) : undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No parent</SelectItem>
                      {menuItems.filter(item => !item.parentId).map((item) => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Required Permissions</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {permissions.map((permission: string) => (
                    <Badge
                      key={permission}
                      variant={formData.requiredPermissions.includes(permission) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newPermissions = formData.requiredPermissions.includes(permission)
                          ? formData.requiredPermissions.filter(p => p !== permission)
                          : [...formData.requiredPermissions, permission];
                        setFormData({ ...formData, requiredPermissions: newPermissions });
                      }}
                    >
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingItem ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Existing Menu Items</h2>
        {menuItems.map((item: NavigationItem) => (
          <Card key={item.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {item.icon && (
                      <div className="w-5 h-5">
                        {React.createElement((LucideIcons as any)[item.icon] || LucideIcons.FileText)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-sm text-gray-500">{item.path}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.requiredPermissions?.map((permission) => (
                      <Badge key={permission} variant="secondary" className="text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(item)}
                    disabled={isCreating || !!editingItem}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MenuManagement;