import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModuleNavigatorProps {
  currentModule: string;
  onModuleChange: (moduleId: string) => void;
}

export const ModuleNavigator: React.FC<ModuleNavigatorProps> = ({
  currentModule,
  onModuleChange,
}) => {
  const modules = [
    { id: "crewing", label: "Crewing" },
    { id: "technical", label: "Technical" },
  ];

  return (
    <div className="w-full">
      <Select value={currentModule} onValueChange={onModuleChange}>
        <SelectTrigger className="w-full h-8 text-xs bg-transparent border-none focus:ring-0 focus:ring-offset-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {modules.map((module) => (
            <SelectItem key={module.id} value={module.id}>
              <div className="flex items-center space-x-2">
                <span className="text-xs">{module.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};