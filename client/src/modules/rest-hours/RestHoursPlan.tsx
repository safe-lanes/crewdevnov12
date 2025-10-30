import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { VariableTasksTable } from './VariableTasksTable';

export const RestHoursPlan = (): JSX.Element => {
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
  const [selectedTab, setSelectedTab] = useState<"fixed" | "variable">("fixed");
  const [periodValue, setPeriodValue] = useState(periodOptions[0]?.value || "");
  const [selectedVessel, setSelectedVessel] = useState("");

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  // Format period for display (e.g., "2024, Mar")
  const displayPeriod = useMemo(() => {
    if (!periodValue || periodValue === "older") return "";
    const [year, month] = periodValue.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = new Date(2000, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });
    return `${year}, ${monthName}`;
  }, [periodValue]);

  const handleClearFilters = () => {
    setPeriodValue(periodOptions[0]?.value || "");
    setSelectedVessel("");
  };

  const title = selectedTab === "fixed" ? "RH Planning - Fixed Tasks" : "RH Planning - Variable Tasks";

  return (
    <div className="flex flex-col h-full">
      {/* Custom header with 3-column layout */}
      <div className="mb-4 grid grid-cols-3 items-center">
        {/* Left: Title */}
        <div>
          <h1 className="text-2xl font-bold text-black">{title}</h1>
        </div>
        
        {/* Center: Period Display + Module Switcher */}
        <div className="flex justify-center items-center gap-4">
          {/* Period Display */}
          <div className="text-sm font-medium text-[#16569e] bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">
            {displayPeriod}
          </div>

          {/* Module Switcher */}
          <div className="flex items-center bg-transparent rounded-full p-1 border border-gray-300 h-8">
            {[
              { id: "fixed", label: "Fixed Tasks" },
              { id: "variable", label: "Variable Tasks" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as "fixed" | "variable")}
                className={`px-4 text-xs rounded-full transition-all duration-200 h-6 flex items-center ${
                  selectedTab === tab.id
                    ? "text-[#16569e] font-bold underline"
                    : "text-gray-600 hover:text-gray-800 font-medium"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Filters Button */}
        <div className="flex justify-end">
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
      </div>

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

          {/* Vessel Single-Select */}
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger 
              className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
              disabled={vesselsLoading}
              data-testid="select-vessel"
            >
              <SelectValue placeholder={vesselsLoading ? "Loading..." : "Vessel"} />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((vessel: any) => (
                <SelectItem key={vessel.id} value={vessel.entryId}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

      {/* Content Area */}
      <div className="px-0 pb-6">
        {selectedTab === "fixed" ? (
          <div className="text-gray-600 p-6">
            Fixed Tasks content will be implemented here.
          </div>
        ) : (
          <VariableTasksTable vesselId={selectedVessel} periodValue={periodValue} />
        )}
      </div>
    </div>
  );
};
