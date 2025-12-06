import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Database, AlertTriangle, ArrowUp } from 'lucide-react';
import { 
  LICENSE_DCE_TEMPLATES, 
  mapApiResponseToLicenseTemplates,
  type LicenseTemplate,
  validateCocSelection,
  isCocLicense,
  getDepartmentDisplayName,
  getCocHierarchyEntry,
  type CocHierarchyEntry,
} from '@/utils/data/licenseDceTemplates';
import { useToast } from '@/hooks/use-toast';

interface LicenseSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedTemplates: LicenseTemplate[], cocsToArchive?: string[]) => void;
  existingLicenseIds?: string[];
}

interface UpgradeConfirmation {
  show: boolean;
  existingCoc: CocHierarchyEntry | null;
  newCoc: CocHierarchyEntry | null;
  newLicenseId: string;
}

// Map of department -> license ID to archive
type CocArchiveMap = Map<string, string>;

export function LicenseSelectionDialog({
  open,
  onClose,
  onConfirm,
  existingLicenseIds = [],
}: LicenseSelectionDialogProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  // Track COCs to archive per department (supports multiple department upgrades in one session)
  const [cocsToArchive, setCocsToArchive] = useState<CocArchiveMap>(new Map());
  const [upgradeConfirmation, setUpgradeConfirmation] = useState<UpgradeConfirmation>({
    show: false,
    existingCoc: null,
    newCoc: null,
    newLicenseId: '',
  });

  const { data: apiTemplates = [], isLoading } = useQuery<Array<{
    entryId: string;
    name: string;
    shortCode?: string;
    description?: string;
    officerMatrixLabel?: string;
  }>>({
    queryKey: ['/api/masters/016/data'],
    enabled: open,
  });

  const templates = useMemo(() => {
    if (apiTemplates.length > 0) {
      return mapApiResponseToLicenseTemplates(apiTemplates);
    }
    return LICENSE_DCE_TEMPLATES;
  }, [apiTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(term) ||
      t.abbr.toLowerCase().includes(term) ||
      t.requirement.toLowerCase().includes(term) ||
      (t.officerMatrixLabel || '').toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  const alreadyAddedIds = useMemo(() => {
    return new Set(existingLicenseIds);
  }, [existingLicenseIds]);

  // Get all license IDs that will be active after selection (existing + selected - archived)
  const getEffectiveLicenseIds = useCallback((currentSelected: Set<string>): string[] => {
    const archiveSet = new Set(cocsToArchive.values());
    const baseIds = existingLicenseIds.filter(id => !archiveSet.has(id));
    const selectedArray = Array.from(currentSelected);
    return [...baseIds, ...selectedArray];
  }, [existingLicenseIds, cocsToArchive]);

  const handleToggle = (id: string) => {
    // If deselecting, just remove
    if (selectedIds.has(id)) {
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      // If we're deselecting a COC, clear any archive for its department
      const cocEntry = getCocHierarchyEntry(id);
      if (cocEntry) {
        setCocsToArchive(prev => {
          const newMap = new Map(prev);
          newMap.delete(cocEntry.department);
          return newMap;
        });
      }
      return;
    }

    // Validate COC selection
    const effectiveIds = getEffectiveLicenseIds(selectedIds);
    const validation = validateCocSelection(effectiveIds, id);

    if (validation.action === 'allow') {
      // No conflict, add normally
      setSelectedIds(prev => new Set([...Array.from(prev), id]));
    } else if (validation.action === 'upgrade') {
      // Show upgrade confirmation dialog
      setUpgradeConfirmation({
        show: true,
        existingCoc: validation.existingCoc,
        newCoc: validation.newCoc,
        newLicenseId: id,
      });
    } else if (validation.action === 'block_same_or_lower') {
      // Block with toast message
      const dept = getDepartmentDisplayName(validation.existingCoc.department);
      toast({
        title: "Cannot Add Certificate",
        description: `You already have "${validation.existingCoc.officerMatrixLabel}" (${dept} Department). You can only upgrade to a higher-level COC, not add a same or lower level one.`,
        variant: "destructive",
      });
    }
  };

  // Handle upgrade confirmation
  const handleUpgradeConfirm = () => {
    const { existingCoc, newCoc, newLicenseId } = upgradeConfirmation;
    if (existingCoc && newCoc) {
      // Track the COC to archive by department
      setCocsToArchive(prev => {
        const newMap = new Map(prev);
        newMap.set(existingCoc.department, existingCoc.id);
        return newMap;
      });
      
      // Remove any previously selected COC in the same department before adding the new one
      // This ensures only the highest-level COC is selected when user upgrades multiple times
      setSelectedIds(prev => {
        const newSet = new Set(Array.from(prev));
        // Remove any existing selected COCs from the same department
        for (const selectedId of Array.from(newSet)) {
          const selectedCoc = getCocHierarchyEntry(selectedId);
          if (selectedCoc && selectedCoc.department === newCoc.department) {
            newSet.delete(selectedId);
          }
        }
        // Add the new (higher level) COC
        newSet.add(newLicenseId);
        return newSet;
      });
    }
    setUpgradeConfirmation({ show: false, existingCoc: null, newCoc: null, newLicenseId: '' });
  };

  const handleUpgradeCancel = () => {
    setUpgradeConfirmation({ show: false, existingCoc: null, newCoc: null, newLicenseId: '' });
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
    
    // Recompute all COCs to archive based on final selection
    // For each COC being added, find any existing COC in the same department to archive
    const archiveIdsSet = new Set<string>();
    for (const selectedId of Array.from(selectedIds)) {
      const selectedCoc = getCocHierarchyEntry(selectedId);
      if (selectedCoc) {
        // Find existing COC in same department
        for (const existingId of existingLicenseIds) {
          const existingCoc = getCocHierarchyEntry(existingId);
          if (existingCoc && existingCoc.department === selectedCoc.department) {
            archiveIdsSet.add(existingId);
          }
        }
      }
    }
    
    const archiveIds = Array.from(archiveIdsSet);
    onConfirm(selected, archiveIds.length > 0 ? archiveIds : undefined);
    setSelectedIds(new Set());
    setSearchTerm('');
    setCocsToArchive(new Map());
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchTerm('');
    setCocsToArchive(new Map());
    setUpgradeConfirmation({ show: false, existingCoc: null, newCoc: null, newLicenseId: '' });
    onClose();
  };

  const availableCount = filteredTemplates.filter(t => !alreadyAddedIds.has(t.id)).length;

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Add License & DCE from Database
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-license-search"
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
              data-testid="button-select-all"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs"
              data-testid="button-clear-all"
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden flex-1">
          <div className="bg-gray-100 grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-600">
            <div className="col-span-1"></div>
            <div className="col-span-1">ID</div>
            <div className="col-span-3">Certificate / Document</div>
            <div className="col-span-2">ABBR</div>
            <div className="col-span-2">Requirement</div>
            <div className="col-span-3">Officer Matrix Label</div>
          </div>

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                Loading certificates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No certificates found matching "{searchTerm}"
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
                      data-testid={`license-option-${template.id}`}
                    >
                      <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => handleToggle(template.id)}
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="col-span-1 text-sm text-gray-800 font-mono">
                        {template.id}
                      </div>
                      <div className="col-span-3 text-sm text-gray-800">
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
                      <div className="col-span-3 text-sm text-gray-600">
                        {template.officerMatrixLabel || ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Show archive notice if upgrading COC */}
        {cocsToArchive.size > 0 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <ArrowUp className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">COC Upgrade:</span> {cocsToArchive.size} existing certificate{cocsToArchive.size > 1 ? 's' : ''} will be archived when you save.
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-license">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || isLoading}
            data-testid="button-confirm-license"
          >
            Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* COC Upgrade Confirmation Dialog */}
    <AlertDialog open={upgradeConfirmation.show} onOpenChange={(open) => !open && handleUpgradeCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ArrowUp className="h-5 w-5 text-blue-600" />
            Upgrade Certificate of Competency
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              You are about to upgrade your COC from:
            </p>
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">Current:</span>
                <span className="font-medium text-gray-800">
                  {upgradeConfirmation.existingCoc?.officerMatrixLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 text-green-600" />
                <span className="text-gray-500 text-sm">Upgrade to:</span>
                <span className="font-medium text-green-700">
                  {upgradeConfirmation.newCoc?.officerMatrixLabel}
                </span>
              </div>
            </div>
            <p className="text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
              Your current COC will be archived and kept in your historical records.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleUpgradeCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgradeConfirm} className="bg-blue-600 hover:bg-blue-700">
            Confirm Upgrade
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
