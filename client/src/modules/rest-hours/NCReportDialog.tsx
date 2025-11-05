import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { NCReport, RestHoursCrewRecord, RestHoursDailyRecord, MasterDataEntry } from "@shared/schema";
import { filterViolations } from './violationFilters';

interface NCReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewRecord: RestHoursCrewRecord;
  vesselName: string;
}

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

interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[];
  isPlan: boolean;
  comments: string;
  violations: number[];
  violationDiagnostics?: ViolationDiagnostic[];
}

// Dummy office users data
const OFFICE_USERS = [
  { name: "John Smith", position: "Marine Superintendent" },
  { name: "Sarah Johnson", position: "Marine Superintendent" },
  { name: "Michael Chen", position: "Marine Superintendent" },
];

export function NCReportDialog({ open, onOpenChange, crewRecord, vesselName: vesselIdProp }: NCReportDialogProps) {
  const { toast } = useToast();
  const [identifiedRootCause, setIdentifiedRootCause] = useState("");
  const [immediateCorrectiveAction, setImmediateCorrectiveAction] = useState("");
  const [preventiveAction, setPreventiveAction] = useState("");
  const [officeClosureVerifiedByName, setOfficeClosureVerifiedByName] = useState("");
  const [officeClosureDate, setOfficeClosureDate] = useState<Date | undefined>(undefined);
  const [submissionStatus, setSubmissionStatus] = useState<"draft" | "vessel-submitted" | "office-submitted">("draft");

  // Fetch vessel name from master data
  const { data: masterData } = useQuery<MasterDataEntry[]>({
    queryKey: ["/api/masters/014/data"],
    enabled: open,
  });

  const vesselName = useMemo(() => {
    if (!masterData) return crewRecord.vesselId;
    const vessel = masterData.find(v => v.entryId === crewRecord.vesselId);
    return vessel?.name || crewRecord.vesselId;
  }, [masterData, crewRecord.vesselId]);

  // Fetch daily records to get violation details
  const { data: dailyRecordContainer } = useQuery<RestHoursDailyRecord | null>({
    queryKey: ['/api/rest-hours-daily-records/by-key', crewRecord.crewMemberId, crewRecord.vesselId, crewRecord.monthValue],
    queryFn: async () => {
      const response = await fetch(`/api/rest-hours-daily-records/by-key/${crewRecord.crewMemberId}/${crewRecord.vesselId}/${crewRecord.monthValue}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch rest hours record');
      }
      return response.json();
    },
    enabled: open,
  });

  // Fetch existing NC report
  const { data: existingReport, isLoading } = useQuery<NCReport | null>({
    queryKey: ["/api/nc-reports", crewRecord.crewMemberId, crewRecord.vesselId, crewRecord.monthValue],
    queryFn: async () => {
      const response = await fetch(`/api/nc-reports?crewMemberId=${crewRecord.crewMemberId}&vesselId=${crewRecord.vesselId}&monthValue=${crewRecord.monthValue}`);
      if (!response.ok) throw new Error("Failed to fetch NC report");
      return response.json();
    },
    enabled: open,
  });

  // Update form fields when existing report is loaded
  useEffect(() => {
    if (existingReport) {
      setIdentifiedRootCause(existingReport.identifiedRootCause || "");
      setImmediateCorrectiveAction(existingReport.immediateCorrectiveAction || "");
      setPreventiveAction(existingReport.preventiveAction || "");
      setOfficeClosureVerifiedByName(existingReport.officeClosureVerifiedByName || "");
      setOfficeClosureDate(existingReport.officeClosureDate ? new Date(existingReport.officeClosureDate) : undefined);
      setSubmissionStatus(existingReport.submissionStatus as any);
    } else {
      // Reset form for new report
      setIdentifiedRootCause("");
      setImmediateCorrectiveAction("");
      setPreventiveAction("");
      setOfficeClosureVerifiedByName("");
      setOfficeClosureDate(undefined);
      setSubmissionStatus("draft");
    }
  }, [existingReport]);

  // Get office user position based on selected name
  const selectedUserPosition = OFFICE_USERS.find(u => u.name === officeClosureVerifiedByName)?.position || "";

  // Save/Submit mutation
  const saveMutation = useMutation({
    mutationFn: async (status: "draft" | "vessel-submitted" | "office-submitted") => {
      const data = {
        crewMemberId: crewRecord.crewMemberId,
        vesselId: crewRecord.vesselId,
        rank: crewRecord.rank,
        monthValue: crewRecord.monthValue,
        ncReference: "STCW/MLC/ILO",
        identifiedRootCause,
        immediateCorrectiveAction,
        preventiveAction,
        officeClosureVerifiedByName,
        officeClosureVerifiedByPosition: selectedUserPosition,
        officeClosureDate,
        submissionStatus: status,
      };
      return await apiRequest("POST", "/api/nc-reports", data);
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nc-reports"] });
      const statusText = status === "draft" ? "saved" : status === "vessel-submitted" ? "submitted by vessel" : "submitted by office";
      toast({
        title: "Success",
        description: `NC Report ${statusText} successfully`,
      });
      setSubmissionStatus(status);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save NC report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => saveMutation.mutate("draft");
  const handleVesselSubmit = () => saveMutation.mutate("vessel-submitted");
  const handleOfficeSubmit = () => saveMutation.mutate("office-submitted");

  const isReadOnly = submissionStatus === "office-submitted";

  // Parse violation details from daily records
  const violationDetails = useMemo(() => {
    if (!dailyRecordContainer || !dailyRecordContainer.dailyRecords) {
      return [];
    }

    let dailyRecords: DailyRecord[] = [];
    try {
      dailyRecords = JSON.parse(dailyRecordContainer.dailyRecords);
    } catch (e) {
      console.error('Failed to parse daily records:', e);
      return [];
    }

    // Get actual violations (not predicted)
    const complianceMode = 'Rest'; // NC reports are based on Rest compliance
    const opaMode = false; // Default to non-OPA mode

    return dailyRecords
      .filter(record => !record.isPlan) // Only actual records
      .filter(record => {
        const violations = Array.isArray(record.violations) ? record.violations : [];
        const filteredViolations = filterViolations(violations, complianceMode, opaMode);
        return filteredViolations.length > 0;
      })
      .map(record => {
        const violations = Array.isArray(record.violations) ? record.violations : [];
        const filteredViolations = filterViolations(violations, complianceMode, opaMode);
        const diagnostics = record.violationDiagnostics || [];
        const filteredDiagnostics = diagnostics.filter(d => filteredViolations.includes(d.code));

        // Format violation codes with descriptions
        const violationCodesStr = filteredViolations
          .sort((a, b) => a - b)
          .map(code => {
            const desc = VIOLATION_CODE_DESCRIPTIONS[code] || `Code ${code}`;
            return `${code} - ${desc}`;
          })
          .join('; ');

        // Format day as date
        const [year, month] = crewRecord.monthValue.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, record.day);
        const dateStr = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

        return {
          date: dateStr,
          codes: violationCodesStr,
          comments: record.comments || "",
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
  }, [dailyRecordContainer, crewRecord.monthValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Rest Hours - Non-Conformity Report</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Header Information - 3 Column Layout */}
            <div className="p-4 bg-gray-50 rounded-lg">
              {/* Row 1 */}
              <div className="grid grid-cols-3 gap-6 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Vessel:</div>
                  <div className="font-semibold">{vesselName}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Seafarer's Name:</div>
                  <div className="font-semibold">{crewRecord.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Month:</div>
                  <div className="font-semibold">{crewRecord.monthValue}</div>
                </div>
              </div>
              {/* Row 2 */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-gray-600">Seafarer's Rank:</div>
                  <div className="font-semibold">{crewRecord.rank}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">NC Reference:</div>
                  <div className="font-semibold">STCW/MLC/ILO</div>
                </div>
                <div></div>
              </div>
            </div>

            {/* Details of Non-Conformity */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Details of Non-Conformity</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Violations</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violationDetails.length > 0 ? (
                      violationDetails.map((detail, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{detail.date}</td>
                          <td className="px-4 py-2 text-sm">{detail.codes}</td>
                          <td className="px-4 py-2 text-sm">{detail.comments}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">
                          No violation details available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="rootCause">Identified Root Cause</Label>
                <Textarea
                  id="rootCause"
                  data-testid="textarea-root-cause"
                  value={identifiedRootCause}
                  onChange={(e) => setIdentifiedRootCause(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Enter identified root cause..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="correctiveAction">Immediate Corrective Action</Label>
                <Textarea
                  id="correctiveAction"
                  data-testid="textarea-corrective-action"
                  value={immediateCorrectiveAction}
                  onChange={(e) => setImmediateCorrectiveAction(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Enter immediate corrective action..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="preventiveAction">Preventive Action</Label>
                <Textarea
                  id="preventiveAction"
                  data-testid="textarea-preventive-action"
                  value={preventiveAction}
                  onChange={(e) => setPreventiveAction(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Enter preventive action..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Closure Verified by Office */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Closure Verified by Office</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="officeName">Name</Label>
                  <Select
                    value={officeClosureVerifiedByName}
                    onValueChange={setOfficeClosureVerifiedByName}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger id="officeName" data-testid="select-office-name" className="mt-1">
                      <SelectValue placeholder="Select office user" />
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
                  <Label htmlFor="officePosition">Position</Label>
                  <div
                    id="officePosition"
                    data-testid="text-office-position"
                    className="mt-1 px-3 py-2 border rounded-md bg-gray-50 text-sm"
                  >
                    {selectedUserPosition || "—"}
                  </div>
                </div>

                <div>
                  <Label htmlFor="officeDate">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        id="officeDate"
                        data-testid="button-office-date"
                        disabled={isReadOnly}
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !officeClosureDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {officeClosureDate ? format(officeClosureDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={officeClosureDate}
                        onSelect={setOfficeClosureDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              {!isReadOnly && (
                <>
                  <Button
                    variant="outline"
                    data-testid="button-save"
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                  >
                    Save
                  </Button>
                  {submissionStatus === "draft" && (
                    <Button
                      data-testid="button-vessel-submit"
                      onClick={handleVesselSubmit}
                      disabled={saveMutation.isPending}
                    >
                      Submit (Vessel)
                    </Button>
                  )}
                  {(submissionStatus === "vessel-submitted" || submissionStatus === "draft") && (
                    <Button
                      data-testid="button-office-submit"
                      onClick={handleOfficeSubmit}
                      disabled={saveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Submit (Office)
                    </Button>
                  )}
                </>
              )}
              {isReadOnly && (
                <div className="text-sm text-gray-500 italic">
                  This report has been submitted by office and is locked.
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
