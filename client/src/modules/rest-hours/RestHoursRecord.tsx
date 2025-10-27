import { useState, useMemo } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { RHRecordsTable } from './RHRecordsTable';

export const RestHoursRecord = (): JSX.Element => {
  // Generate last 12 months for period dropdown
  const periodOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const monthYear = `${month}-${year}`;
      const value = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({ label: monthYear, value });
    }
    
    return options;
  }, []);

  const [showFilters, setShowFilters] = useState(true);
  const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [fleetValue, setFleetValue] = useState("");
  const [addGroupValue, setAddGroupValue] = useState("");
  const [periodValue, setPeriodValue] = useState(periodOptions[0]?.value || "");

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  const toggleVessel = (vesselName: string) => {
    setSelectedVessels(prev => 
      prev.includes(vesselName) 
        ? prev.filter(v => v !== vesselName)
        : [...prev, vesselName]
    );
  };

  const handleClearFilters = () => {
    setFilterType("vessel");
    setSelectedVessels([]);
    setFleetValue("");
    setAddGroupValue("");
    setPeriodValue(periodOptions[0]?.value || "");
  };

  return (
    <div className="flex flex-col h-full">
      <SectionTitleComponents title="RH Records - Office Overview">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </SectionTitleComponents>

      {showFilters && (
        <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
          {/* Period Dropdown */}
          <Select value={periodValue} onValueChange={setPeriodValue}>
            <SelectTrigger 
              className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
              data-testid="select-period"
            >
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="older">Older Periods...</SelectItem>
            </SelectContent>
          </Select>

          {/* Radio Group for Vessel/Fleet/Add Group */}
          <RadioGroup 
            value={filterType} 
            onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
            className="flex items-center gap-6"
          >
            {/* Vessel Radio + Multi-Select */}
            <div className="flex items-center gap-2">
              <RadioGroupItem 
                value="vessel" 
                id="filter-vessel"
                className="h-4 w-4"
                data-testid="radio-vessel"
              />
              <Label 
                htmlFor="filter-vessel" 
                className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
              >
                Vessel
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-8 w-40 ml-2 text-xs text-[#0f172a] justify-between bg-transparent dark:bg-neutral-900 border-input"
                    disabled={vesselsLoading}
                    data-testid="select-vessel-multi"
                  >
                    <span className="truncate">
                      {selectedVessels.length > 0 
                        ? `${selectedVessels.length} selected` 
                        : vesselsLoading ? "Loading..." : "Vessel"
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2" align="start">
                  <div className="max-h-60 overflow-y-auto">
                    {vessels.map((vessel: any) => (
                      <div 
                        key={vessel.id} 
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        <Checkbox 
                          checked={selectedVessels.includes(vessel.name)}
                          onCheckedChange={() => toggleVessel(vessel.name)}
                          data-testid={`checkbox-vessel-${vessel.id}`}
                        />
                        <label 
                          className="text-sm cursor-pointer flex-1"
                          onClick={() => toggleVessel(vessel.name)}
                        >
                          {vessel.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Fleet Radio + Select */}
            <div className="flex items-center gap-2">
              <RadioGroupItem 
                value="fleet" 
                id="filter-fleet"
                className="h-4 w-4"
                data-testid="radio-fleet"
              />
              <Label 
                htmlFor="filter-fleet" 
                className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
              >
                Fleet Group
              </Label>
              <Select value={fleetValue} onValueChange={setFleetValue}>
                <SelectTrigger 
                  className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                  data-testid="select-fleet-value"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                  <SelectItem value="fleet2">Fleet Group 2</SelectItem>
                  <SelectItem value="fleet3">Fleet Group 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Add Group Radio + Select */}
            <div className="flex items-center gap-2">
              <RadioGroupItem 
                value="addGroup" 
                id="filter-addgroup"
                className="h-4 w-4"
                data-testid="radio-addgroup"
              />
              <Label 
                htmlFor="filter-addgroup" 
                className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
              >
                Additional Group
              </Label>
              <Select value={addGroupValue} onValueChange={setAddGroupValue}>
                <SelectTrigger 
                  className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                  data-testid="select-addgroup-value"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group1">Additional Group 1</SelectItem>
                  <SelectItem value="group2">Additional Group 2</SelectItem>
                  <SelectItem value="group3">Additional Group 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </RadioGroup>

          {/* Clear Button */}
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        </div>
      )}

      {/* RH Records Table */}
      <div className="px-4 pb-4">
        <RHRecordsTable 
          selectedVessels={filterType === 'vessel' ? selectedVessels : []}
          selectedMonth={periodValue}
        />
      </div>
    </div>
  );
};
