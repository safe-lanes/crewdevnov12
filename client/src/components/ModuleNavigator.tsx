import React from "react";
import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
    <Select value={currentModule} onValueChange={onModuleChange}>
      <SelectTrigger className="w-3 h-3 p-0 border-none bg-transparent focus:ring-0 focus:ring-offset-0 hover:bg-gray-200 rounded-sm">
        <ChevronDown className="w-3 h-3 text-[#4f5863]" />
      </SelectTrigger>
      <SelectContent>
        {modules.map((module) => (
          <SelectItem key={module.id} value={module.id}>
            <span className="text-xs">{module.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};