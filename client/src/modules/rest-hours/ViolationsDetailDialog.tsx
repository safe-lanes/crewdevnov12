import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { RestHoursDailyRecord } from '@shared/schema';
import { filterViolations } from './violationFilters';

interface ViolationsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  monthValue: string;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
}

interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[];
  isPlan: boolean;
  comments: string;
  violations: number[];
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

    // Filter records to show only days with violations (excluding predicted/plan records)
    return dailyRecords
      .filter(record => !record.isPlan) // Only show actual recorded violations, not planned
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

        return {
          day: record.day,
          violations: filteredViolations.sort((a, b) => a - b).join(', '),
          comments: record.comments || '',
        };
      })
      .sort((a, b) => a.day - b.day);
  }, [recordContainer, complianceMode, opaMode]);

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
            Violations - {crewMemberName} - {formatMonth(monthValue)}
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
                      <td className="px-4 py-3 text-sm">{record.violations}</td>
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
