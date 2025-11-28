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
import { Search, Loader2, CheckCircle2, Star } from 'lucide-react';
import {
  DEFAULT_VISA_COUNTRIES,
  PRIORITY_COUNTRIES,
  mapApiResponseToVisaCountries,
  mergeWithDefaultCountries,
  type VisaCountryTemplate,
} from '@/utils/data/visaCountryTemplates';

interface VisaSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedCountries: VisaCountryTemplate[]) => void;
  existingCountryIds?: string[];
}

export function VisaSelectionDialog({
  open,
  onClose,
  onConfirm,
  existingCountryIds = [],
}: VisaSelectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const { data: apiCountries = [], isLoading } = useQuery<Array<{
    id: number;
    nuid?: string;
    name: string;
    countryName?: string;
  }>>({
    queryKey: ['/api/masters/001/data'],
    enabled: open,
  });

  const countries = useMemo(() => {
    let result: VisaCountryTemplate[];
    
    if (apiCountries.length > 0) {
      const mapped = mapApiResponseToVisaCountries(apiCountries);
      result = mergeWithDefaultCountries(mapped);
    } else {
      result = [...DEFAULT_VISA_COUNTRIES];
    }
    
    const schengenExists = result.some(c => c.name.toLowerCase() === 'schengen');
    if (!schengenExists) {
      result.unshift({ id: 'SCHENGEN', name: 'Schengen', isPriority: true });
    }
    
    return result;
  }, [apiCountries]);

  const filteredCountries = useMemo(() => {
    if (!searchTerm) return countries;
    const term = searchTerm.toLowerCase();
    return countries.filter(c => c.name.toLowerCase().includes(term));
  }, [countries, searchTerm]);

  const alreadyAddedIds = useMemo(() => {
    return new Set(existingCountryIds);
  }, [existingCountryIds]);

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

  const handleSelectAllPriority = () => {
    const priorityIds = filteredCountries
      .filter(c => c.isPriority && !alreadyAddedIds.has(c.id))
      .map(c => c.id);
    setSelectedIds(new Set(priorityIds));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const selected = countries.filter(c => selectedIds.has(c.id));
    onConfirm(selected);
    setSelectedIds(new Set());
    setSearchTerm('');
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchTerm('');
    onClose();
  };

  const availableCount = filteredCountries.filter(c => !alreadyAddedIds.has(c.id)).length;
  const priorityCount = filteredCountries.filter(c => c.isPriority).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold" style={{ color: '#16569e' }}>
            Add Visa Countries
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-visa-countries"
          />
        </div>

        <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
          <span>{availableCount} country(ies) available ({priorityCount} priority)</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAllPriority}
              className="text-xs h-7"
              data-testid="button-select-priority-visa"
            >
              <Star className="h-3 w-3 mr-1 text-yellow-500" />
              Select Priority
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs h-7"
              data-testid="button-clear-all-visa"
            >
              Clear All
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading countries...</span>
            </div>
          ) : filteredCountries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No countries found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-10 p-2"></th>
                  <th className="text-left p-2 font-medium text-gray-600">Country</th>
                  <th className="w-20 p-2 text-center font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCountries.filter(c => c.isPriority).length > 0 && (
                  <tr className="bg-yellow-100">
                    <td colSpan={3} className="p-2 text-xs font-semibold text-yellow-800">
                      <Star className="h-3 w-3 inline mr-1 text-yellow-600 fill-yellow-600" />
                      Priority Countries
                    </td>
                  </tr>
                )}
                {filteredCountries.filter(c => c.isPriority).map((country) => {
                  const isAlreadyAdded = alreadyAddedIds.has(country.id);
                  const isSelected = selectedIds.has(country.id);

                  return (
                    <tr
                      key={country.id}
                      className={`border-b hover:bg-yellow-100 bg-yellow-50 ${isAlreadyAdded ? 'opacity-60' : ''}`}
                    >
                      <td className="p-2 text-center">
                        <Checkbox
                          checked={isSelected}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => handleToggle(country.id)}
                          data-testid={`checkbox-visa-country-${country.id}`}
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{country.name}</span>
                        </div>
                      </td>
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
                {filteredCountries.filter(c => !c.isPriority).length > 0 && (
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="p-2 text-xs font-semibold text-gray-600">
                      All Countries
                    </td>
                  </tr>
                )}
                {filteredCountries.filter(c => !c.isPriority).map((country) => {
                  const isAlreadyAdded = alreadyAddedIds.has(country.id);
                  const isSelected = selectedIds.has(country.id);

                  return (
                    <tr
                      key={country.id}
                      className={`border-b hover:bg-gray-50 ${isAlreadyAdded ? 'bg-gray-100 opacity-60' : ''}`}
                    >
                      <td className="p-2 text-center">
                        <Checkbox
                          checked={isSelected}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => handleToggle(country.id)}
                          data-testid={`checkbox-visa-country-${country.id}`}
                        />
                      </td>
                      <td className="p-2">
                        <span>{country.name}</span>
                      </td>
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
            data-testid="button-cancel-visa-selection"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            style={{ backgroundColor: '#16569e' }}
            data-testid="button-confirm-visa-selection"
          >
            Add Selected ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
