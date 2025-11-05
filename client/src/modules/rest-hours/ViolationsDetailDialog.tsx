import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RestHoursDailyRecord } from '@shared/schema';
import { filterViolations } from './violationFilters';

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

interface ViolationDiagnostic {
  code: number;
  windowStart: string;
  reason: string;
  violatingRanges?: Array<{ startCell: number; endCell: number; startDay: number; monthName?: string }>;
}

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

interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[];
  isPlan: boolean;
  comments: string;
  violations: number[];
  violationDiagnostics?: ViolationDiagnostic[];
  hoursOfRest24hr: number;
  hoursOfWork24hr: number;
  anyPeriodRest24hr: number;
  anyPeriodWork24hr: number;
  anyPeriodRest7day: number;
  anyPeriodWork7day: number;
}

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

  // Parse and filter daily records
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

    // Filter records to show only days with violations
    // isPredicted=true shows planned violations (isPlan=true)
    // isPredicted=false shows actual violations (isPlan=false)
    return dailyRecords
      .filter(record => isPredicted ? record.isPlan : !record.isPlan)
      .filter(record => {
        // Get violations array and filter using the standard filtering logic
        const violations = Array.isArray(record.violations) ? record.violations : [];
        const filteredViolations = filterViolations(violations, complianceMode, opaMode);
        return filteredViolations.length > 0;
      })
      .map(record => {
        // Get and filter violations for display using the standard filtering logic
        const violations = Array.isArray(record.violations) ? record.violations : [];
        const filteredViolations = filterViolations(violations, complianceMode, opaMode);
        
        // Filter diagnostics to match filtered violations
        const diagnostics = record.violationDiagnostics || [];
        const filteredDiagnostics = diagnostics.filter(d => filteredViolations.includes(d.code));

        return {
          ...record,
          filteredViolations: filteredViolations.sort((a, b) => a - b),
          filteredDiagnostics,
        };
      })
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
