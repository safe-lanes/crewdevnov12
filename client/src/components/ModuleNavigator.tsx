
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Grid3X3, BarChart3 } from "lucide-react";

interface Module {
  id: string;
  name: string;
  icon: React.ReactNode;
  description?: string;
  available: boolean;
}

interface ModuleNavigatorProps {
  currentModule: string;
  onModuleChange: (moduleId: string) => void;
}

export function ModuleNavigator({ currentModule, onModuleChange }: ModuleNavigatorProps) {
  const [showModuleDialog, setShowModuleDialog] = useState(false);

  const modules: Module[] = [
    {
      id: "crewing",
      name: "Crewing",
      icon: <BarChart3 className="h-5 w-5" />,
      description: "Crew management and appraisals",
      available: true
    }
  ];

  const handleModuleSelect = (moduleId: string) => {
    onModuleChange(moduleId);
    setShowModuleDialog(false);
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => setShowModuleDialog(true)}>
        <div className="w-6 h-6 mb-1">
          <Grid3X3 className="h-6 w-6 text-[#4f5863]" />
        </div>
        <div className="text-[#4f5863] text-[10px] font-normal font-['Mulish',Helvetica]">
          Modules
        </div>
      </div>

      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {modules.map((module) => (
              <Button
                key={module.id}
                variant={currentModule === module.id ? "default" : "ghost"}
                className="w-full justify-start h-auto p-4"
                onClick={() => handleModuleSelect(module.id)}
                disabled={!module.available}
              >
                <div className="flex items-center gap-3">
                  {module.icon}
                  <div className="text-left">
                    <div className="font-medium">{module.name}</div>
                    {module.description && (
                      <div className="text-sm text-muted-foreground">
                        {module.description}
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
