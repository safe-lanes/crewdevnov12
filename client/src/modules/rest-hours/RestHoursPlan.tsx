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
import { PeriodFilter } from '@/components/filters/PeriodFilter';
import { parseRestHoursFilters, partToPeriodFilter } from './utils/filterParams';
import { useViewport } from '@/hooks/useViewport';
import { useRestHoursFiltersStore } from '@/stores/restHoursFiltersStore';

export const RestHoursPlan = (): JSX.Element => {
  const viewport = useViewport();
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';

  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [newMonthTrigger, setNewMonthTrigger] = useState<{ tasks: FixedTask[]; timestamp: number } | null>(null);
  const [saveHandler, setSaveHandler] = useState<(() => void) | null>(null);

  const [showFilters, setShowFilters] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"fixed" | "variable">("fixed");
  
  const {
    periodValue,
    setPeriodValue,
    planVesselId: selectedVessel,
    setPlanVesselId: setSelectedVessel,
  } = useRestHoursFiltersStore();

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  // Parse URL parameters on mount (localStorage is handled by the store automatically)
  useEffect(() => {
    const search = window.location.search;
    if (!search) return;
    
    const filters = parseRestHoursFilters(search);
    
    const parsedPeriod = partToPeriodFilter(filters);
    if (parsedPeriod) {
      setPeriodValue(parsedPeriod);
    }
    
    if (filters.vesselIds && filters.vesselIds.length === 1) {
      setSelectedVessel(filters.vesselIds[0]);
    }
  }, []);

  // Auto-select first vessel when vessels load (only if no vessel selected)
  useEffect(() => {
    if (vesselsLoading || vessels.length === 0) return;
    
    if (!selectedVessel) {
      setSelectedVessel(vessels[0].entryId);
    }
  }, [vesselsLoading, vessels, selectedVessel, setSelectedVessel]);

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

  // Responsive filter bar for Plan page
  const renderFilterBar = () => {
    if (!showFilters) return null;

    // Phone layout: vertical stack
    if (isPhone) {
      return (
        <div className="flex flex-col gap-3 mb-4 p-3 bg-transparent rounded-lg" data-testid="filter-container">
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />

          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger 
              className="h-8 w-full text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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

          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="h-8 w-full text-[#8798ad] text-[11px] border-[#e1e8ed]"
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        </div>
      );
    }

    // Tablet and Desktop: horizontal layout
    return (
      <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
        <PeriodFilter value={periodValue} onChange={setPeriodValue} />

        <Select value={selectedVessel} onValueChange={setSelectedVessel}>
          <SelectTrigger 
            className="h-8 w-40 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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

        <Button
          variant="outline"
          onClick={handleClearFilters}
          className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Custom header - responsive layout */}
      {isPhone ? (
        /* Phone: vertical stack */
        <div className="mb-4 flex flex-col gap-3">
          <h1 className="text-xl font-bold text-black">{title}</h1>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-[#16569e] bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">
              {displayPeriod}
            </div>

            <div className="flex items-center bg-transparent rounded-full p-1 border border-gray-300 h-8">
              {[
                { id: "fixed", label: "Fixed" },
                { id: "variable", label: "Variable" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as "fixed" | "variable")}
                  className={`px-3 text-xs rounded-full transition-all duration-200 h-6 flex items-center ${
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

          <div className="flex flex-wrap gap-2">
            {selectedTab === "fixed" && (
              <>
                {!isEditMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditMode(true)}
                      disabled={!selectedVessel || !periodValueString}
                      className="h-8 gap-1"
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
                      className="h-8 gap-1"
                      data-testid="button-new-month"
                    >
                      <Plus className="h-4 w-4" />
                      New
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => { if (saveHandler) saveHandler(); }}
                    disabled={!saveHandler}
                    className="h-8 gap-1"
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
              className="h-8 gap-1 bg-white dark:bg-gray-800"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>
      ) : isTablet ? (
        /* Tablet: 2-column layout */
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-black">{title}</h1>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-[#16569e] bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">
                {displayPeriod}
              </div>
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
          </div>
          <div className="flex gap-2">
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
                    onClick={() => { if (saveHandler) saveHandler(); }}
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
      ) : (
        /* Desktop: 3-column layout (original) */
        <div className="mb-4 grid grid-cols-3 items-center">
          <div>
            <h1 className="text-2xl font-bold text-black">{title}</h1>
          </div>
          
          <div className="flex justify-center items-center gap-4">
            <div className="text-sm font-medium text-[#16569e] bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">
              {displayPeriod}
            </div>

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
                    onClick={() => { if (saveHandler) saveHandler(); }}
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
      )}

      {renderFilterBar()}

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
