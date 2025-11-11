import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Filter, Edit2, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { VariableTasksTable } from './VariableTasksTable';
import { FixedTasksTable } from './FixedTasksTable';
import { useToast } from '@/hooks/use-toast';
import type { FixedTask } from '@shared/schema';
import { PeriodFilter, type PeriodFilterValue } from '@/components/filters/PeriodFilter';
import { parseRestHoursFilters, serializeRestHoursFilters, periodFilterToPart, partToPeriodFilter, type RestHoursFilters } from './utils/filterParams';

export const RestHoursPlan = (): JSX.Element => {
  const [location, setLocation] = useLocation();
  const hasSyncedFromUrl = useRef(false);
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [newMonthTrigger, setNewMonthTrigger] = useState<{ tasks: FixedTask[]; timestamp: number } | null>(null);
  const [saveHandler, setSaveHandler] = useState<(() => void) | null>(null);

  const [showFilters, setShowFilters] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"fixed" | "variable">("fixed");
  const [periodValue, setPeriodValue] = useState<PeriodFilterValue>({
    mode: 'year-month',
    year: currentYear,
    month: currentMonth,
  });
  const [selectedVessel, setSelectedVessel] = useState("");

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  // Parse URL parameters whenever location changes
  useEffect(() => {
    const search = window.location.search;
    if (!search) {
      hasSyncedFromUrl.current = true;
      return;
    }
    
    const filters = parseRestHoursFilters(search);
    
    // Apply period filter (only if different from current state)
    const parsedPeriod = partToPeriodFilter(filters);
    if (parsedPeriod && JSON.stringify(parsedPeriod) !== JSON.stringify(periodValue)) {
      setPeriodValue(parsedPeriod);
    }
    
    // Apply vessel selection (only if different and vesselIds has exactly one vessel)
    if (filters.vesselIds && filters.vesselIds.length === 1 && filters.vesselIds[0] !== selectedVessel) {
      setSelectedVessel(filters.vesselIds[0]);
    }
    
    // Mark as synced after processing URL params
    hasSyncedFromUrl.current = true;
  }, [location]); // Re-run when location changes

  // Auto-select first vessel when vessels load (only if no URL params)
  useEffect(() => {
    if (!vesselsLoading && vessels.length > 0 && !selectedVessel) {
      const search = window.location.search;
      if (!search) {
        setSelectedVessel(vessels[0].entryId);
      }
    }
  }, [vesselsLoading, vessels, selectedVessel]);
  
  // Sync filter state to URL whenever filters change
  useEffect(() => {
    // Skip until initial URL sync is complete (prevents race conditions during mount)
    if (!hasSyncedFromUrl.current) return;
    
    // Skip if vessels are still loading
    if (vesselsLoading) return;
    
    // Build filter object from current state
    const currentFilters: RestHoursFilters = {
      ...periodFilterToPart(periodValue),
      filterType: 'vessel',
    };
    
    // Add vessel ID if selected
    if (selectedVessel) {
      currentFilters.vesselIds = [selectedVessel];
    }
    
    // Serialize to URL
    const search = serializeRestHoursFilters(currentFilters);
    const targetPath = `/rest-hours/plan${search ? `?${search}` : ''}`;
    const currentPath = window.location.pathname + window.location.search;
    
    // Only update URL if it's actually different (prevents infinite loops)
    if (currentPath !== targetPath) {
      setLocation(targetPath, { replace: true });
    }
  }, [periodValue, selectedVessel, vesselsLoading, setLocation]);

  // Convert PeriodFilterValue to string format (YYYY-MM)
  const periodValueString = useMemo(() => {
    if (periodValue.mode === 'year-month' && periodValue.year && periodValue.month) {
      return `${periodValue.year}-${String(periodValue.month).padStart(2, '0')}`;
    }
    return '';
  }, [periodValue]);

  // Format period for display (e.g., "2024, Mar")
  const displayPeriod = useMemo(() => {
    if (!periodValueString) return "";
    const [year, month] = periodValueString.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = new Date(2000, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });
    return `${year}, ${monthName}`;
  }, [periodValueString]);

  // Reset edit mode when vessel, period, or tab changes
  useEffect(() => {
    setIsEditMode(false);
    setSaveHandler(null); // Clear save handler when context changes
  }, [selectedVessel, periodValue, selectedTab]);

  const handleClearFilters = () => {
    setPeriodValue({
      mode: 'year-month',
      year: currentYear,
      month: currentMonth,
    });
    setSelectedVessel("");
  };

  // Memoize the callback to prevent infinite render loops
  const handleSaveHandlerReady = useCallback((handler: (() => void) | null) => {
    setSaveHandler(handler ? () => handler : null);
  }, []);

  const handleNewMonth = async () => {
    if (!selectedVessel || !periodValueString) {
      toast({
        title: 'Selection required',
        description: 'Please select a vessel and period first',
        variant: 'destructive',
      });
      return;
    }

    // Get previous month
    const [year, month] = periodValueString.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = (prevDate.getMonth() + 1).toString().padStart(2, '0');
    const prevMonthYear = `${prevYear}-${prevMonth}`;

    try {
      const response = await fetch(`/api/fixed-tasks?vesselId=${selectedVessel}&monthYear=${prevMonthYear}`);
      if (response.ok) {
        const prevTasks: FixedTask[] = await response.json();
        // Trigger state update in child via ref
        setNewMonthTrigger({ tasks: prevTasks, timestamp: Date.now() });
        setIsEditMode(true);
        toast({
          title: 'Previous month copied',
          description: 'Data from previous month loaded for editing',
        });
      } else {
        setIsEditMode(false);
        toast({
          title: 'No previous data',
          description: 'No fixed tasks found for previous month',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load previous month:', error);
      setIsEditMode(false);
      toast({
        title: 'Error',
        description: 'Failed to load previous month data',
        variant: 'destructive',
      });
    }
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

        {/* Right: Action Buttons + Filters */}
        <div className="flex justify-end gap-2">
          {selectedTab === "fixed" && (
            <>
              {!isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                    disabled={!selectedVessel || !periodValueString}
                    className="h-8 gap-2"
                    data-testid="button-edit"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewMonth}
                    disabled={!selectedVessel || !periodValueString}
                    className="h-8 gap-2"
                    data-testid="button-new-month"
                  >
                    <Plus className="h-4 w-4" />
                    New Month
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (saveHandler) {
                      saveHandler();
                    }
                  }}
                  disabled={!saveHandler}
                  className="h-8 gap-2"
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              )}
            </>
          )}
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
          {/* Period Filter */}
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />

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
        {!periodValueString ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Please select a year and month to view planning data
          </div>
        ) : selectedTab === "fixed" ? (
          <FixedTasksTable 
            vesselId={selectedVessel} 
            monthYear={periodValueString}
            isEditMode={isEditMode}
            setIsEditMode={setIsEditMode}
            newMonthTrigger={newMonthTrigger}
            onSaveHandlerReady={handleSaveHandlerReady}
          />
        ) : (
          <VariableTasksTable vesselId={selectedVessel} periodValue={periodValueString} />
        )}
      </div>
    </div>
  );
};
