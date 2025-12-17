import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Database } from 'lucide-react';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';

// Company Training type from /api/company-trainings
interface CompanyTraining {
  id: number;
  trainingMasterId: number;
  companyId: string;
  trainingLabel: string;
  abr: string | null;
  requirement: string | null;
  groupCode: string | null;
  sortOrder: number | null;
}

interface TrainingCourseSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedTemplates: TrainingCourseTemplate[]) => void;
  existingCourseIds?: string[];
}

export function TrainingCourseSelectionDialog({
  open,
  onClose,
  onConfirm,
  existingCourseIds = [],
}: TrainingCourseSelectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch company trainings from Admin > Training Matrix > Company
  const { data: companyTrainings = [], isLoading, isError } = useQuery<CompanyTraining[]>({
    queryKey: ['/api/company-trainings'],
    enabled: open,
    retry: false,
  });

  // Map company trainings to TrainingCourseTemplate format
  const templates = useMemo(() => {
    return companyTrainings.map((training): TrainingCourseTemplate => ({
      id: training.id.toString(),
      companyId: training.companyId,
      name: training.trainingLabel,
      abbr: training.abr || '',
      requirement: training.requirement || '',
    }));
  }, [companyTrainings]);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(term) ||
      t.abbr.toLowerCase().includes(term) ||
      t.requirement.toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  const alreadyAddedIds = useMemo(() => {
    return new Set(existingCourseIds);
  }, [existingCourseIds]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allIds = filteredTemplates
      .filter(t => !alreadyAddedIds.has(t.id))
      .map(t => t.id);
    setSelectedIds(new Set(allIds));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const selected = templates.filter(t => selectedIds.has(t.id));
    onConfirm(selected);
    setSelectedIds(new Set());
    setSearchTerm('');
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchTerm('');
    onClose();
  };

  const availableCount = filteredTemplates.filter(t => !alreadyAddedIds.has(t.id)).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Add Training Course from Database
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search training courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-training-search"
          />
        </div>

        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-gray-600">
            {selectedIds.size} selected of {availableCount} available
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
              disabled={availableCount === 0}
              data-testid="button-select-all-training"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs"
              data-testid="button-clear-all-training"
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden flex-1">
          <div className="bg-[#52baf3] grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-white items-center">
            <div className="col-span-1">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === availableCount}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleSelectAll();
                  } else {
                    handleClearAll();
                  }
                }}
                disabled={availableCount === 0}
                className="h-4 w-4 border-white data-[state=checked]:bg-white data-[state=checked]:text-[#52baf3]"
                data-testid="checkbox-select-all-header"
              />
            </div>
            <div className="col-span-2">Company ID</div>
            <div className="col-span-5">Training Label</div>
            <div className="col-span-2">ABBR</div>
            <div className="col-span-2">Requirement</div>
          </div>

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                Loading training courses...
              </div>
            ) : (isError || templates.length === 0) ? (
              <div className="p-8 text-center text-gray-500">
                No training courses available in database.
                <br />
                <span className="text-xs text-gray-400 mt-2 block">
                  Training course templates will be added later.
                </span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No training courses found matching "{searchTerm}"
              </div>
            ) : (
              <div className="divide-y">
                {filteredTemplates.map((template) => {
                  const isAlreadyAdded = alreadyAddedIds.has(template.id);
                  const isSelected = selectedIds.has(template.id);

                  return (
                    <div
                      key={template.id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer hover:bg-gray-50 transition-colors ${
                        isAlreadyAdded ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                      } ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => !isAlreadyAdded && handleToggle(template.id)}
                      data-testid={`training-option-${template.id}`}
                    >
                      <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => handleToggle(template.id)}
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="col-span-2 text-sm text-gray-600 font-mono">
                        {template.companyId || '-'}
                      </div>
                      <div className="col-span-5 text-sm text-gray-800">
                        {template.name}
                        {isAlreadyAdded && (
                          <span className="ml-2 text-xs text-gray-400">(already added)</span>
                        )}
                      </div>
                      <div className="col-span-2 text-sm text-gray-600 font-mono">
                        {template.abbr}
                      </div>
                      <div className="col-span-2 text-sm text-gray-600">
                        {template.requirement}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-training">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || isLoading}
            data-testid="button-confirm-training"
          >
            Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
