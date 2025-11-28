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
import { Search, Loader2, CheckCircle2 } from 'lucide-react';
import {
  TRAVEL_DOCUMENT_TEMPLATES,
  mapApiResponseToTravelDocumentTemplates,
  type TravelDocumentTemplate,
} from '@/utils/data/travelDocumentTemplates';

interface TravelDocumentSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedTemplates: TravelDocumentTemplate[]) => void;
  existingDocumentIds?: string[];
}

export function TravelDocumentSelectionDialog({
  open,
  onClose,
  onConfirm,
  existingDocumentIds = [],
}: TravelDocumentSelectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const { data: apiTemplates = [], isLoading } = useQuery<Array<{
    entryId: string;
    name: string;
  }>>({
    queryKey: ['/api/masters/018/data'],
    enabled: open,
  });

  const templates = useMemo(() => {
    if (apiTemplates.length > 0) {
      return mapApiResponseToTravelDocumentTemplates(apiTemplates);
    }
    return TRAVEL_DOCUMENT_TEMPLATES;
  }, [apiTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter(t => t.name.toLowerCase().includes(term));
  }, [templates, searchTerm]);

  const alreadyAddedIds = useMemo(() => {
    return new Set(existingDocumentIds);
  }, [existingDocumentIds]);

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
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold" style={{ color: '#16569e' }}>
            Add Travel & ID Documents
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-travel-docs"
          />
        </div>

        <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
          <span>{availableCount} document(s) available</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs h-7"
              data-testid="button-select-all-travel-docs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs h-7"
              data-testid="button-clear-all-travel-docs"
            >
              Clear All
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading documents...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No documents found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-10 p-2"></th>
                  <th className="text-left p-2 font-medium text-gray-600">ID</th>
                  <th className="text-left p-2 font-medium text-gray-600">Document</th>
                  <th className="w-20 p-2 text-center font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => {
                  const isAlreadyAdded = alreadyAddedIds.has(template.id);
                  const isSelected = selectedIds.has(template.id);

                  return (
                    <tr
                      key={template.id}
                      className={`border-b hover:bg-gray-50 ${isAlreadyAdded ? 'bg-gray-100 opacity-60' : ''}`}
                    >
                      <td className="p-2 text-center">
                        <Checkbox
                          checked={isSelected}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => handleToggle(template.id)}
                          data-testid={`checkbox-travel-doc-${template.id}`}
                        />
                      </td>
                      <td className="p-2 font-mono text-xs text-gray-500">
                        {template.id}
                      </td>
                      <td className="p-2">{template.name}</td>
                      <td className="p-2 text-center">
                        {isAlreadyAdded && (
                          <span className="inline-flex items-center text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Added
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-travel-doc-selection"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            style={{ backgroundColor: '#16569e' }}
            data-testid="button-confirm-travel-doc-selection"
          >
            Add Selected ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
