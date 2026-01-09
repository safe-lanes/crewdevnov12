import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RestHoursDailyRecord } from '@shared/schema';
import { filterViolations } from './violationFilters';
import type { ViolationDailyRecord, ViolationDiagnostic } from './types';

// Violation code descriptions mapping
const VIOLATION_CODE_DESCRIPTIONS: Record<number, string> = {
  1: "Minimum 10 hours of rest in any 24 hour period",
  2: "Minimum hours of rest in any 7 day period = 77",
  3: "Hours of rest may be divided into no more than two periods, one of which shall be at least six hours in length",
  4: "Interval between rest periods not to exceed 14 hours",
  5: "ILO Work - Maximum 14 hours of work in any 24 hour period",
  6: "ILO Work - Maximum 72 hours of work in any 7 day period",
  7: "OPA - Maximum 15 hours of work in any 24 hour period",
  8: "OPA - Maximum 36 hours of work in 72 hours",
};

interface ViolationsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  monthValue: string;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  isPredicted?: boolean;
}

// Using ViolationDailyRecord from shared types
type DailyRecord = ViolationDailyRecord;

export function ViolationsDetailDialog({
  open,
  onOpenChange,
  crewMemberId,
  crewMemberName,
  vesselId,
  monthValue,
  complianceMode,
  opaMode,
  isPredicted = false,
}: ViolationsDetailDialogProps) {
  // Fetch daily records container for this crew member
  const { data: recordContainer, isLoading } = useQuery<RestHoursDailyRecord | null>({
    queryKey: ['/api/rest-hours-daily-records/by-key', crewMemberId, vesselId, monthValue],
    queryFn: async () => {
      const response = await fetch(`/api/rest-hours-daily-records/by-key/${crewMemberId}/${vesselId}/${monthValue}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch rest hours record');
      }
      return response.json();
    },
    enabled: open,
  });

  // Parse and filter daily records, grouping violations by majorityDay for consistency with grid display
  const violationRecords = useMemo(() => {
    if (!recordContainer || !recordContainer.dailyRecords) {
      return [];
    }

    let dailyRecords: DailyRecord[] = [];
    try {
      dailyRecords = JSON.parse(recordContainer.dailyRecords);
    } catch (e) {
      console.error('Failed to parse daily records:', e);
      return [];
    }

    // Filter records by isPlan status first
    // isPredicted=true shows planned violations (isPlan=true)
    // isPredicted=false shows actual violations (isPlan=false)
    const recordsForMode = dailyRecords.filter(record => 
      isPredicted ? record.isPlan : !record.isPlan
    );

    // Group violations by their assigned day (majorityDay from diagnostics)
    // This ensures the popup shows violations on the same day as the grid
    const violationsByDay = new Map<number, { 
      violations: number[]; 
      diagnostics: ViolationDiagnostic[];
      comments: string;
    }>();

    for (const record of recordsForMode) {
      const violations = Array.isArray(record.violations) ? record.violations : [];
      const diagnostics = record.violationDiagnostics || [];
      
      // For each violation, determine its display day using majorityDay from diagnostic
      for (const violationCode of violations) {
        // Filter by compliance mode
        const filteredViolations = filterViolations([violationCode], complianceMode, opaMode);
        if (filteredViolations.length === 0) continue;
        
        // Find the diagnostic for this violation
        const diagnostic = diagnostics.find(d => d.code === violationCode);
        
        // Use majorityDay if available, otherwise fall back to record.day
        const displayDay = diagnostic?.majorityDay ?? record.day;
        
        // Get or create the entry for this day
        const existing = violationsByDay.get(displayDay) || { 
          violations: [], 
          diagnostics: [],
          comments: ''
        };
        
        // Add violation if not already present
        if (!existing.violations.includes(violationCode)) {
          existing.violations.push(violationCode);
        }
        
        // Add diagnostic if not already present
        if (diagnostic && !existing.diagnostics.some(d => d.code === violationCode)) {
          existing.diagnostics.push(diagnostic);
        }
        
        // Use comments from the first record that contributes to this day
        if (!existing.comments && record.comments) {
          existing.comments = record.comments;
        }
        
        violationsByDay.set(displayDay, existing);
      }
    }

    // Convert map to sorted array of records
    return Array.from(violationsByDay.entries())
      .map(([day, data]) => ({
        day,
        filteredViolations: data.violations.sort((a, b) => a - b),
        filteredDiagnostics: data.diagnostics,
        comments: data.comments,
      }))
      .sort((a, b) => a.day - b.day);
  }, [recordContainer, complianceMode, opaMode, isPredicted]);

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  // Format day for display
  const formatDay = (day: number, monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isPredicted ? 'Predicted Violations' : 'Violations'} - {crewMemberName} - {formatMonth(monthValue)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View detailed violation information for individual crew member
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : violationRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No violations found</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#52baf3] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-sm">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Violations</th>
                    <th className="px-4 py-3 text-left font-medium text-sm">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {violationRecords.map((record) => (
                    <tr key={record.day} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDay(record.day, monthValue)}</td>
                      <td className="px-4 py-3 text-sm">
                        {record.filteredViolations.map((code, idx) => {
                          const diagnostic = record.filteredDiagnostics.find(d => d.code === code);
                          
                          // If no diagnostic available, just show the code
                          if (!diagnostic) {
                            return (
                              <span key={code}>
                                {code}{idx < record.filteredViolations.length - 1 ? ', ' : ''}
                              </span>
                            );
                          }
                          
                          // Show code with tooltip
                          return (
                            <TooltipProvider key={code}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="cursor-help underline decoration-dotted hover:bg-pink-100 px-0.5 rounded"
                                  >
                                    {code}{idx < record.filteredViolations.length - 1 ? ', ' : ''}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent 
                                  side="right" 
                                  align="start" 
                                  sideOffset={8}
                                  className="max-w-[220px] text-[11px] z-50 bg-white text-gray-900"
                                >
                                  <div className="space-y-0.5">
                                    <div className="leading-snug">{VIOLATION_CODE_DESCRIPTIONS[diagnostic.code]}</div>
                                    <div className="text-gray-600 leading-snug">{diagnostic.reason}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">{record.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
