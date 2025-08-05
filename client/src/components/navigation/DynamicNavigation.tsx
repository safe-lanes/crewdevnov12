import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/hooks/useNavigation";
import type { NavigationItem } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface DynamicNavigationProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
  showIcons?: boolean;
  showLabels?: boolean;
}

interface NavItemProps {
  item: NavigationItem;
  isActive: boolean;
  orientation: "horizontal" | "vertical";
  showIcons: boolean;
  showLabels: boolean;
  depth?: number;
}

const NavItem: React.FC<NavItemProps> = ({
  item,
  isActive,
  orientation,
  showIcons,
  showLabels,
  depth = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  
  // Get the icon component from lucide-react
  const IconComponent = item.icon ? (LucideIcons as any)[item.icon] : null;

  const handleToggle = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  const itemContent = (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        {
          "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300": isActive,
          "text-gray-700 dark:text-gray-300": !isActive,
          "flex-col": orientation === "vertical" && showIcons && showLabels,
          "min-w-[60px] justify-center": orientation === "horizontal" && showIcons && !showLabels,
        }
      )}
      style={{ paddingLeft: orientation === "vertical" ? `${12 + depth * 16}px` : undefined }}
    >
      {showIcons && IconComponent && (
        <IconComponent className="w-4 h-4 flex-shrink-0" />
      )}
      {showLabels && (
        <span className={cn(
          "font-medium",
          orientation === "vertical" && showIcons && showLabels ? "text-xs mt-1" : "text-sm"
        )}>
          {item.title}
        </span>
      )}
      {hasChildren && orientation === "vertical" && (
        <div className="ml-auto">
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </div>
      )}
    </div>
  );

  if (hasChildren && orientation === "vertical") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className="w-full text-left"
          onClick={handleToggle}
        >
          {itemContent}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1">
          {item.children?.map((child) => (
            <NavItem
              key={child.id}
              item={child}
              isActive={false} // You might want to check if child is active
              orientation={orientation}
              showIcons={showIcons}
              showLabels={showLabels}
              depth={depth + 1}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Link href={item.path}>
      <a className="block w-full">
        {itemContent}
      </a>
    </Link>
  );
};

export const DynamicNavigation: React.FC<DynamicNavigationProps> = ({
  className,
  orientation = "horizontal",
  showIcons = true,
  showLabels = true,
}) => {
  const [location] = useLocation();
  const { getNavigationTree, isLoading, error } = useNavigation();

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md"
              style={{ width: `${60 + Math.random() * 40}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-red-500 text-sm", className)}>
        Failed to load navigation
      </div>
    );
  }

  const navigationTree = getNavigationTree();

  return (
    <nav
      className={cn(
        "flex gap-1",
        {
          "flex-col": orientation === "vertical",
          "flex-row": orientation === "horizontal",
        },
        className
      )}
    >
      {navigationTree.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          isActive={location === item.path}
          orientation={orientation}
          showIcons={showIcons}
          showLabels={showLabels}
        />
      ))}
    </nav>
  );
};

export default DynamicNavigation;