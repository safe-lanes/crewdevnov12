import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import type { RestHoursCrewRecord, NCReport } from '@shared/schema';
import { filterViolations } from './violationFilters';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { NCReportDialog } from './NCReportDialog';
import { cn } from '@/lib/utils';
import type { ViolationDailyRecord, ViolationDiagnostic } from './types';

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

interface VesselReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vesselId: string;
  vesselName: string;
  monthValue: string;
  complianceMode: 'Rest' | 'Work';
  opaMode: boolean;
  vesselReviewStatus: string;
  mode?: 'vessel' | 'office';
  officeReviewStatus?: string;
}

// Using ViolationDailyRecord from shared types
type DailyRecord = ViolationDailyRecord;

interface ViolationRecord {
  crewMemberId: string;
  crewMemberName: string;
  rank: string;
  day: number;
  filteredViolations: number[];
  filteredDiagnostics: ViolationDiagnostic[];
  comments: string;
}

interface NCRecord {
  crewMemberId: string;
  crewMemberName: string;
  rank: string;
  datesInvolved: string;
  status: string;
}

// Office users data (same as NC Report)
const OFFICE_USERS = [
  { name: "John Smith", position: "Marine Superintendent" },
  { name: "Sarah Johnson", position: "Marine Superintendent" },
  { name: "Michael Chen", position: "Marine Superintendent" },
];

export function VesselReviewDialog({
  open,
  onOpenChange,
  vesselId,
  vesselName,
  monthValue,
  complianceMode,
  opaMode,
  vesselReviewStatus,
  mode = 'vessel',
  officeReviewStatus = '',
}: VesselReviewDialogProps) {
  const { toast } = useToast();
  const [vesselComment, setVesselComment] = useState('');
  const [officeComment, setOfficeComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewDate, setReviewDate] = useState<Date | undefined>(undefined);
  const [ncReportDialogOpen, setNCReportDialogOpen] = useState(false);
  const [selectedNCReportRecord, setSelectedNCReportRecord] = useState<RestHoursCrewRecord | null>(null);

  const isVesselMode = mode === 'vessel';
  const isOfficeMode = mode === 'office';
  const isReadOnly = isVesselMode 
    ? vesselReviewStatus === 'Completed' 
    : officeReviewStatus === 'Completed';
  
  // Get reviewer position based on selected name
  const reviewerPosition = OFFICE_USERS.find(u => u.name === reviewerName)?.position || '';

  // Fetch all crew records for this vessel and month
  const queryParams = new URLSearchParams();
  queryParams.append('vesselIds', vesselId);
  queryParams.append('monthValue', monthValue);
  queryParams.append('complianceMode', complianceMode);
  queryParams.append('opaMode', String(opaMode));

  const { data: crewSummaries = [], isLoading: isLoadingSummaries } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-crew-records', vesselId, monthValue, complianceMode, opaMode],
    queryFn: async () => {
      const url = `/api/rest-hours-crew-records?${queryParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch crew records');
      return response.json();
    },
    enabled: open,
  });

  // Get crew IDs with violations
  const crewIdsWithViolations = useMemo(() => {
    return crewSummaries
      .filter(crew => {
        const violationDatesField = crew.violationDates;
        return violationDatesField && violationDatesField !== '[]';
      })
      .map(crew => crew.crewMemberId);
  }, [crewSummaries]);

  // Fetch daily records for crew with violations
  const { data: allDailyRecords = [], isLoading: isLoadingDaily } = useQuery<any[]>({
    queryKey: ['/api/rest-hours-daily-records'],
    queryFn: async () => {
      const response = await fetch('/api/rest-hours-daily-records');
      if (!response.ok) throw new Error('Failed to fetch daily records');
      return response.json();
    },
    enabled: open && crewIdsWithViolations.length > 0,
  });

  // Fetch existing vessel comment
  const { data: vesselCommentData } = useQuery<{ comment: string } | null>({
    queryKey: ['/api/vessel-violation-comments', vesselId, monthValue],
    queryFn: async () => {
      const response = await fetch(`/api/vessel-violation-comments?vesselId=${vesselId}&monthValue=${monthValue}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch vessel comment');
      }
      return response.json();
    },
    enabled: open,
  });

  // Fetch existing office comment
  const { data: officeCommentData } = useQuery<{ 
    comment: string;
    reviewerName: string;
    reviewerPosition: string;
    reviewDate: string;
  } | null>({
    queryKey: ['/api/office-violation-comments', vesselId, monthValue],
    queryFn: async () => {
      const response = await fetch(`/api/office-violation-comments?vesselId=${vesselId}&monthValue=${monthValue}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch office comment');
      }
      return response.json();
    },
    enabled: open && isOfficeMode,
  });

  // Fetch NC reports for this vessel/month
  const { data: allNCReports = [] } = useQuery<NCReport[]>({
    queryKey: ['/api/nc-reports'],
    queryFn: async () => {
      const response = await fetch('/api/nc-reports');
      if (!response.ok) throw new Error('Failed to fetch NC reports');
      return response.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (vesselCommentData) {
      setVesselComment(vesselCommentData.comment || '');
    } else {
      setVesselComment('');
    }
  }, [vesselCommentData]);

  useEffect(() => {
    if (officeCommentData) {
      setOfficeComment(officeCommentData.comment || '');
      setReviewerName(officeCommentData.reviewerName || '');
      setReviewDate(officeCommentData.reviewDate ? new Date(officeCommentData.reviewDate) : undefined);
    } else {
      setOfficeComment('');
      setReviewerName('');
      setReviewDate(undefined);
    }
  }, [officeCommentData]);

  const isLoading = isLoadingSummaries || isLoadingDaily;

  // Parse violations from daily records
  const violationRecords = useMemo(() => {
    const allViolations: ViolationRecord[] = [];
    const vesselCrewSummaries = crewSummaries.filter(crew => crew.vesselId === vesselId);
    const dailyRecordsMap = new Map<string, DailyRecord[]>();
    
    const filteredRecords = allDailyRecords.filter(record =>
      crewIdsWithViolations.includes(record.crewMemberId) && 
      record.vesselId === vesselId &&
      record.monthYear === monthValue
    );
    
    filteredRecords.forEach(recordContainer => {
      try {
        const dailyRecords: DailyRecord[] = JSON.parse(recordContainer.dailyRecords);
        dailyRecordsMap.set(recordContainer.crewMemberId, dailyRecords);
      } catch (e) {
        console.error('Failed to parse daily records:', e);
      }
    });

    vesselCrewSummaries.forEach(crew => {
      const violationDatesField = crew.violationDates;
      if (!violationDatesField) return;

      let violationDays: number[] = [];
      try {
        violationDays = JSON.parse(violationDatesField);
      } catch (e) {
        console.error('Failed to parse violation dates:', e);
        return;
      }

      const dailyRecords = dailyRecordsMap.get(crew.crewMemberId) || [];

      violationDays.forEach(day => {
        const dayRecord = dailyRecords.find(r => r.day === day && !r.isPlan);
        
        if (dayRecord) {
          const violations = Array.isArray(dayRecord.violations) ? dayRecord.violations : [];
          const filteredViolations = filterViolations(violations, complianceMode, opaMode);
          const diagnostics = dayRecord.violationDiagnostics || [];
          const filteredDiagnostics = diagnostics.filter(d => filteredViolations.includes(d.code));

          allViolations.push({
            crewMemberId: crew.crewMemberId,
            crewMemberName: crew.name,
            rank: crew.rank,
            day: day,
            filteredViolations: filteredViolations.sort((a, b) => a - b),
            filteredDiagnostics,
            comments: dayRecord.comments || '',
          });
        }
      });
    });

    return allViolations.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.rank !== b.rank) return a.rank.localeCompare(b.rank);
      return a.crewMemberName.localeCompare(b.crewMemberName);
    });
  }, [crewSummaries, allDailyRecords, vesselId, monthValue, complianceMode, opaMode, crewIdsWithViolations]);

  // Build NC summary records (grouped by crew member)
  const ncRecords = useMemo(() => {
    const records: NCRecord[] = [];
    const vesselCrewSummaries = crewSummaries.filter(crew => crew.vesselId === vesselId);

    vesselCrewSummaries.forEach(crew => {
      const ncCount = crew.totalNCs;
      if (!ncCount || ncCount === 0) return;

      const violationDatesField = crew.violationDates;
      if (!violationDatesField) return;

      let violationDays: number[] = [];
      try {
        violationDays = JSON.parse(violationDatesField);
      } catch (e) {
        console.error('Failed to parse violation dates:', e);
        return;
      }

      const datesInvolved = violationDays.sort((a, b) => a - b).join(', ');

      // Find NC report for this crew member
      const ncReport = allNCReports.find(
        report => 
          report.crewMemberId === crew.crewMemberId && 
          report.vesselId === vesselId && 
          report.monthValue === monthValue
      );

      let status = 'Open';
      if (ncReport) {
        if (ncReport.submissionStatus === 'office-submitted') {
          status = 'Submitted (Office)';
        } else if (ncReport.submissionStatus === 'vessel-submitted') {
          status = 'Submitted (Vessel)';
        }
      }

      records.push({
        crewMemberId: crew.crewMemberId,
        crewMemberName: crew.name,
        rank: crew.rank,
        datesInvolved,
        status,
      });
    });

    return records.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank.localeCompare(b.rank);
      return a.crewMemberName.localeCompare(b.crewMemberName);
    });
  }, [crewSummaries, allNCReports, vesselId, monthValue]);

  // Mutation to save vessel comment
  const saveCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      return apiRequest('POST', '/api/vessel-violation-comments', {
        vesselId,
        monthValue,
        comment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-violation-comments', vesselId, monthValue] });
      toast({
        title: 'Success',
        description: 'Vessel comment saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save vessel comment',
        variant: 'destructive',
      });
    },
  });

  // Mutation to save office comment
  const saveOfficeCommentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/office-violation-comments', {
        vesselId,
        monthValue,
        comment: officeComment,
        reviewerName,
        reviewerPosition,
        reviewDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/office-violation-comments', vesselId, monthValue] });
      queryClient.invalidateQueries({ queryKey: ['/api/rest-hours-vessel-records'] });
      toast({
        title: 'Success',
        description: 'Office comment saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save office comment',
        variant: 'destructive',
      });
    },
  });

  // Mutation to submit vessel review
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      // First save the comment
      await apiRequest('POST', '/api/vessel-violation-comments', {
        vesselId,
        monthValue,
        comment: vesselComment,
      });

      // Then update the vessel review submission date
      return apiRequest('POST', '/api/rest-hours-vessel-records/submit-review', {
        vesselId,
        monthValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rest-hours-vessel-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-violation-comments', vesselId, monthValue] });
      toast({
        title: 'Success',
        description: 'Vessel review submitted successfully',
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit vessel review',
        variant: 'destructive',
      });
    },
  });

  // Mutation to submit office review
  const submitOfficeReviewMutation = useMutation({
    mutationFn: async () => {
      // First save the office comment
      await apiRequest('POST', '/api/office-violation-comments', {
        vesselId,
        monthValue,
        comment: officeComment,
        reviewerName,
        reviewerPosition,
        reviewDate,
      });

      // Then update the office review submission date
      return apiRequest('POST', '/api/rest-hours-vessel-records/submit-office-review', {
        vesselId,
        monthValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rest-hours-vessel-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/office-violation-comments', vesselId, monthValue] });
      toast({
        title: 'Success',
        description: 'Office review submitted successfully',
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit office review',
        variant: 'destructive',
      });
    },
  });

  const handleSaveComment = () => {
    if (isVesselMode) {
      saveCommentMutation.mutate(vesselComment);
    } else {
      saveOfficeCommentMutation.mutate();
    }
  };

  const handleSubmit = () => {
    if (isVesselMode) {
      if (!vesselComment.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter vessel comments before submitting',
          variant: 'destructive',
        });
        return;
      }
      submitReviewMutation.mutate();
    } else {
      if (!officeComment.trim() || !reviewerName || !reviewDate) {
        toast({
          title: 'Validation Error',
          description: 'Please enter office comments and complete the signature fields before submitting',
          variant: 'destructive',
        });
        return;
      }
      submitOfficeReviewMutation.mutate();
    }
  };

  const handleViewNCReport = (crewMemberId: string) => {
    const crewSummary = crewSummaries.find(c => c.crewMemberId === crewMemberId && c.vesselId === vesselId);
    if (crewSummary) {
      setSelectedNCReportRecord(crewSummary);
      setNCReportDialogOpen(true);
    }
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatDay = (day: number, monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isVesselMode ? 'Vessel Review' : 'Office Review'} - {vesselName} - {formatMonth(monthValue)}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Review vessel rest hours violations and non-conformities
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {/* Violations Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Violations</h3>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : violationRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No violations found</div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Rank</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Violations</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {violationRecords.map((record, index) => (
                        <tr key={`${record.crewMemberId}-${record.day}-${index}`} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{formatDay(record.day, monthValue)}</td>
                          <td className="px-4 py-2 text-sm">{record.rank}</td>
                          <td className="px-4 py-2 text-sm">{record.crewMemberName}</td>
                          <td className="px-4 py-2 text-sm">
                            {record.filteredViolations.map((code, idx) => {
                              const diagnostic = record.filteredDiagnostics.find(d => d.code === code);
                              
                              if (!diagnostic) {
                                return (
                                  <span key={code}>
                                    {code}{idx < record.filteredViolations.length - 1 ? ', ' : ''}
                                  </span>
                                );
                              }
                              
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
                          <td className="px-4 py-2 text-sm">{record.comments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Non-Conformities Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Non-Conformities</h3>
              {ncRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No non-conformities found</div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Rank</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Dates Involved</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                        <th className="px-4 py-2 text-center text-sm font-semibold">View Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ncRecords.map((record) => (
                        <tr key={record.crewMemberId} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{record.rank}</td>
                          <td className="px-4 py-2 text-sm">{record.crewMemberName}</td>
                          <td className="px-4 py-2 text-sm">{record.datesInvolved}</td>
                          <td className="px-4 py-2 text-sm">{record.status}</td>
                          <td className="px-4 py-2 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewNCReport(record.crewMemberId)}
                              data-testid={`button-view-nc-report-${record.crewMemberId}`}
                              className="text-xs"
                            >
                              View Report
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Vessel Comments Section */}
            <div className="space-y-3 border-t pt-4">
              <label className="text-sm font-medium text-gray-700">
                Vessel Comments (Master / Chief Engineer)
              </label>
              {isOfficeMode ? (
                <div className="min-h-[100px] p-3 border rounded-md bg-gray-50 text-sm whitespace-pre-wrap">
                  {vesselComment || 'No vessel comments provided'}
                </div>
              ) : (
                <Textarea
                  value={vesselComment}
                  onChange={(e) => setVesselComment(e.target.value)}
                  placeholder="Enter corrective actions or notes regarding these violations..."
                  className="min-h-[100px] resize-y"
                  data-testid="textarea-vessel-comment"
                  disabled={isReadOnly}
                />
              )}
            </div>

            {/* Office Comments Section (only in office mode) */}
            {isOfficeMode && (
              <div className="space-y-3 border-t pt-4">
                <label className="text-sm font-medium text-gray-700">
                  Office Comments
                </label>
                <Textarea
                  value={officeComment}
                  onChange={(e) => setOfficeComment(e.target.value)}
                  placeholder="Enter office review comments..."
                  className="min-h-[100px] resize-y"
                  data-testid="textarea-office-comment"
                  disabled={isReadOnly}
                />
                
                {/* Office Signature Fields */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-3">Reviewed by Office</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Name</label>
                      <Select
                        value={reviewerName}
                        onValueChange={setReviewerName}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger data-testid="select-reviewer-name">
                          <SelectValue placeholder="Select reviewer" />
                        </SelectTrigger>
                        <SelectContent>
                          {OFFICE_USERS.map((user) => (
                            <SelectItem key={user.name} value={user.name}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Position</label>
                      <div
                        data-testid="text-reviewer-position"
                        className="px-3 py-2 border rounded-md bg-gray-50 text-sm"
                      >
                        {reviewerPosition || "—"}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            data-testid="button-review-date"
                            disabled={isReadOnly}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !reviewDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {reviewDate ? format(reviewDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={reviewDate}
                            onSelect={setReviewDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isReadOnly && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={handleSaveComment}
                  disabled={saveCommentMutation.isPending || saveOfficeCommentMutation.isPending}
                  variant="outline"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  data-testid={`button-save-${isVesselMode ? 'vessel' : 'office'}-review`}
                >
                  {(saveCommentMutation.isPending || saveOfficeCommentMutation.isPending) ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitReviewMutation.isPending || submitOfficeReviewMutation.isPending}
                  className="bg-green-600 text-white hover:bg-green-700"
                  data-testid={`button-submit-${isVesselMode ? 'vessel' : 'office'}-review`}
                >
                  {(submitReviewMutation.isPending || submitOfficeReviewMutation.isPending) ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedNCReportRecord && (
        <NCReportDialog
          key={`nc-report-${selectedNCReportRecord.crewMemberId}-${selectedNCReportRecord.vesselId}-${selectedNCReportRecord.monthValue}`}
          open={ncReportDialogOpen}
          onOpenChange={setNCReportDialogOpen}
          crewRecord={selectedNCReportRecord}
          vesselName={vesselName}
        />
      )}
    </>
  );
}
