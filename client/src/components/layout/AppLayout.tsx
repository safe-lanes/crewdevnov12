import React from "react";
import { DynamicNavigation } from "@/components/navigation/DynamicNavigation";
import { useCurrentUser } from "@/hooks/useNavigation";
import { Button } from "@/components/ui/button";
import { Menu, User, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const currentUser = useCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img
                className="w-8 h-8"
                alt="Logo"
                src="/figmaAssets/group-2.png"
                onError={(e) => {
                  // Fallback to placeholder if image doesn't exist
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Seafarer Performance Management
              </h1>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 flex justify-center max-w-4xl mx-8">
            <DynamicNavigation
              orientation="horizontal"
              showIcons={true}
              showLabels={true}
              className="flex-wrap justify-center"
            />
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline">{currentUser.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{currentUser.username}</span>
                      <span className="text-xs text-gray-500 capitalize">{currentUser.role}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex items-center space-x-2">
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;