import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Loader2, AlertCircle } from 'lucide-react';

interface SimulatedCrewMember {
    rank: string;
    crewMemberId: string;
    crewName?: string;
    joiningDate?: string;
    planId?: number; // vesselPlanning.id for precise slot matching
}

interface ComplianceMatrixDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vesselId?: string;
    simulatedCrew?: SimulatedCrewMember[];
}

interface ComplianceRuleResult {
    category: string;
    label: string;
    rankPair: string;
    requiredValue: number;
    actualValue: number;
    unit: string;
    status: 'pass' | 'fail' | 'not_applicable';
}

interface ComplianceCheckResult {
    oilMajorName: string;
    overallStatus: 'green' | 'yellow' | 'red';
    results: ComplianceRuleResult[];
    summary: {
        passed: number;
        failed: number;
        total: number;
    };
}

interface OilMajorRule {
    id: number;
    oilMajorName: string;
    isActive: boolean;
    rules: any;
}

const StatusDot = ({ status }: { status: 'green' | 'yellow' | 'red' | 'gray' | 'pass' | 'fail' | 'not_applicable' }) => {
    const colors = {
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
        gray: 'bg-gray-400',
        pass: 'bg-green-500',
        fail: 'bg-red-500',
        not_applicable: 'bg-gray-400'
    };
    
    return (
        <div className={`w-3 h-3 rounded-full ${colors[status]}`} data-testid={`status-${status}`}></div>
    );
};

function groupResultsByCategory(results: ComplianceRuleResult[]): Record<string, ComplianceRuleResult[]> {
    const grouped: Record<string, ComplianceRuleResult[]> = {};
    for (const result of results) {
        if (!grouped[result.category]) {
            grouped[result.category] = [];
        }
        grouped[result.category].push(result);
    }
    return grouped;
}

// Interface for grouped English Proficiency results
interface GroupedProficiencyResult {
    label: string;
    groupName: string;  // e.g., "All Deck Officers"
    requiredValue: number;
    worstActualValue: number;
    overallStatus: 'pass' | 'fail' | 'not_applicable';
    individualResults: ComplianceRuleResult[];
}

// Group English Proficiency results by their description (label) to avoid repetition
function groupEnglishProficiencyResults(results: ComplianceRuleResult[]): GroupedProficiencyResult[] {
    const groupMap = new Map<string, GroupedProficiencyResult>();
    
    for (const result of results) {
        const key = result.label;
        
        if (!groupMap.has(key)) {
            // Determine group name from the label
            let groupName = 'Officers';
            if (result.label.toLowerCase().includes('all deck officer')) {
                groupName = 'All Deck Officers';
            } else if (result.label.toLowerCase().includes('all engineering officer') || 
                       result.label.toLowerCase().includes('all engineer officer')) {
                groupName = 'All Engineering Officers';
            } else if (result.label.toLowerCase().includes('all officer')) {
                groupName = 'All Officers';
            }
            
            groupMap.set(key, {
                label: result.label,
                groupName: groupName,
                requiredValue: result.requiredValue,
                worstActualValue: result.actualValue,
                overallStatus: result.status,
                individualResults: [result]
            });
        } else {
            const existing = groupMap.get(key)!;
            existing.individualResults.push(result);
            
            // Find the worst actual value (lowest proficiency level)
            // -2 = No crew, -1 = Unknown, 0 = Poor, 1 = Fair, 2 = Good, 3 = Excellent, 4 = Native
            if (result.actualValue < existing.worstActualValue) {
                existing.worstActualValue = result.actualValue;
            }
            
            // If any result fails, overall status is fail
            if (result.status === 'fail') {
                existing.overallStatus = 'fail';
            }
        }
    }
    
    return Array.from(groupMap.values());
}

// Helper to convert proficiency level index to text
const PROFICIENCY_LEVELS = ['Poor', 'Fair', 'Good', 'Excellent', 'Native'];

function formatRequirementValue(req: ComplianceRuleResult): { required: string; actual: string } {
    if (req.category === 'English Proficiency') {
        // Convert numeric index to proficiency level text
        // -2 means No crew assigned, -1 means Unknown, >= 0 maps to PROFICIENCY_LEVELS
        const requiredLevel = req.requiredValue >= 0 
            ? (PROFICIENCY_LEVELS[req.requiredValue] || 'Unknown')
            : 'Unknown';
        let actualLevel: string;
        if (req.actualValue === -2) {
            actualLevel = 'N/A';
        } else if (req.actualValue >= 0) {
            actualLevel = PROFICIENCY_LEVELS[req.actualValue] || 'Unknown';
        } else {
            actualLevel = 'Unknown';
        }
        return { required: requiredLevel, actual: actualLevel };
    }
    
    // For conditional rules with "not_applicable" status
    if (req.status === 'not_applicable') {
        return {
            required: `${req.requiredValue} ${req.unit}`,
            actual: 'N/A (condition not met)'
        };
    }
    
    // For conditional rules (unit may be 'months', 'conditional', or 'officers')
    if (req.unit === 'conditional' || req.unit === 'officers') {
        return {
            required: `${req.requiredValue} ${req.unit}`,
            actual: `${req.actualValue} ${req.unit}`
        };
    }
    
    // For other categories, show numeric value with unit
    return { 
        required: `${req.requiredValue} ${req.unit}`, 
        actual: `${req.actualValue} ${req.unit}` 
    };
}

export const ComplianceMatrixDialog: React.FC<ComplianceMatrixDialogProps> = ({
    open,
    onOpenChange,
    vesselId,
    simulatedCrew
}) => {
    const [selectedMajor, setSelectedMajor] = useState<{ id: number; name: string; status: string } | null>(null);
    const [selectedResult, setSelectedResult] = useState<ComplianceCheckResult | null>(null);

    const isSimulatedMode = simulatedCrew && simulatedCrew.length > 0;

    const { data: oilMajorRules = [], isLoading: isLoadingRules } = useQuery<OilMajorRule[]>({
        queryKey: ['/api/oil-major-rules'],
        enabled: open
    });

    // Fetch compliance data - use POST for simulated mode, GET for normal mode
    const { data: complianceData, isLoading: isLoadingCompliance } = useQuery<{ vesselId: string; results: ComplianceCheckResult[]; message?: string; simulated?: boolean }>({
        queryKey: isSimulatedMode 
            ? [`/api/compliance/matrix/${vesselId}/simulated`, JSON.stringify(simulatedCrew)]
            : [`/api/compliance/matrix/${vesselId}`],
        enabled: open && !!vesselId && oilMajorRules.length > 0,
        staleTime: 0, // Always refetch compliance data to ensure fresh results
        queryFn: async () => {
            console.log('[ComplianceDialog] Fetching compliance data:', { isSimulatedMode, vesselId, simulatedCrew });
            if (isSimulatedMode) {
                // Use POST for simulated compliance check
                console.log('[ComplianceDialog] Making POST request to simulated endpoint');
                const response = await fetch(`/api/compliance/matrix/${vesselId}/simulated`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ simulatedCrew })
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch simulated compliance data');
                }
                const data = await response.json();
                console.log('[ComplianceDialog] Simulated compliance response:', data);
                return data;
            } else {
                // Use GET for normal compliance check
                const response = await fetch(`/api/compliance/matrix/${vesselId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch compliance data');
                }
                return response.json();
            }
        }
    });

    const oilMajors = useMemo(() => {
        const baseList = oilMajorRules.map(rule => ({
            id: rule.id,
            name: rule.oilMajorName,
            status: 'gray' as const
        }));
        
        if (complianceData?.results) {
            return baseList.map(item => {
                const result = complianceData.results.find(r => r.oilMajorName === item.name);
                return {
                    ...item,
                    status: result?.overallStatus || 'gray'
                };
            });
        }
        
        return baseList;
    }, [oilMajorRules, complianceData]);

    useEffect(() => {
        if (oilMajors.length > 0 && !selectedMajor) {
            setSelectedMajor(oilMajors[0]);
        }
    }, [oilMajors, selectedMajor]);

    useEffect(() => {
        if (selectedMajor && complianceData?.results) {
            const result = complianceData.results.find(r => r.oilMajorName === selectedMajor.name);
            setSelectedResult(result || null);
        }
    }, [selectedMajor, complianceData]);

    const groupedResults = selectedResult ? groupResultsByCategory(selectedResult.results) : {};
    const isLoading = isLoadingRules || isLoadingCompliance;
    const hasNoRules = oilMajorRules.length === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200">
                    <DialogTitle className="text-lg font-medium text-[#16569e]" data-testid="dialog-title-compliance">
                        {isSimulatedMode ? 'Compliance Matrix - Simulated Crew' : 'Compliance Matrix'}
                    </DialogTitle>
                    {isSimulatedMode && simulatedCrew && (
                        <p className="text-sm text-muted-foreground mt-1" data-testid="text-simulated-crew-info">
                            Simulating: {simulatedCrew.map(c => `${c.crewName || c.crewMemberId} as ${c.rank}`).join(', ')}
                        </p>
                    )}
                </DialogHeader>

                <div className="flex h-[calc(90vh-120px)]">
                    {/* Left Table - Oil Majors List */}
                    <div className="w-64 border-r border-gray-200 flex flex-col">
                        {isLoadingRules ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : hasNoRules ? (
                            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                <AlertCircle className="w-10 h-10 text-gray-400 mb-3" />
                                <p className="text-sm text-gray-500 mb-2">No oil major rules configured</p>
                                <p className="text-xs text-gray-400">Contact administrator to configure rules</p>
                            </div>
                        ) : oilMajors.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                <AlertCircle className="w-10 h-10 text-gray-400 mb-3" />
                                <p className="text-sm text-gray-500 mb-2">No vessel data available</p>
                                <p className="text-xs text-gray-400">Select a vessel with crew to check compliance</p>
                            </div>
                        ) : (
                            <ScrollArea className="flex-1">
                                <Table>
                                    <TableBody>
                                        {oilMajors.map((major) => (
                                            <TableRow
                                                key={major.id}
                                                className={`cursor-pointer hover:bg-gray-50 ${
                                                    selectedMajor?.id === major.id ? 'bg-blue-50' : ''
                                                }`}
                                                onClick={() => setSelectedMajor(major)}
                                                data-testid={`row-oil-major-${major.id}`}
                                            >
                                                <TableCell className="py-3 px-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-700">{major.name}</span>
                                                        <StatusDot status={major.status as 'green' | 'yellow' | 'red' | 'gray'} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        )}
                    </div>

                    {/* Right Table - Requirements */}
                    <div className="flex-1 flex flex-col">
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-gray-700" data-testid="text-requirements-for">
                                    Requirements For: {selectedMajor?.name || 'Select an oil major'}
                                </h3>
                                {selectedResult && (
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <StatusDot status="green" />
                                            Passed: {selectedResult.summary.passed}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <StatusDot status="red" />
                                            Failed: {selectedResult.summary.failed}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <ScrollArea className="flex-1">
                            <div className="px-6 py-4">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    </div>
                                ) : !selectedResult || Object.keys(groupedResults).length === 0 ? (
                                    <div className="text-center text-gray-500 py-8">
                                        {hasNoRules 
                                            ? 'No oil major rules configured for this oil major'
                                            : `No requirements configured for ${selectedMajor?.name || 'this oil major'}`
                                        }
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(groupedResults).map(([category, requirements], categoryIndex) => {
                                            // For English Proficiency, group results by description
                                            const isEnglishProficiency = category === 'English Proficiency';
                                            const groupedProficiency = isEnglishProficiency 
                                                ? groupEnglishProficiencyResults(requirements)
                                                : null;
                                            
                                            return (
                                            <div key={categoryIndex}>
                                                <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                                    {category}
                                                </h4>
                                                
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-gray-50">
                                                            <TableHead className="text-xs font-medium text-gray-700 w-[50%]">
                                                                Description
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[20%]">
                                                                Required
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[20%]">
                                                                Actual
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[10%]">
                                                                Status
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {isEnglishProficiency && groupedProficiency ? (
                                                            // Render grouped English Proficiency rows with hover
                                                            groupedProficiency.map((group, groupIndex) => {
                                                                const requiredLevel = group.requiredValue >= 0 
                                                                    ? (PROFICIENCY_LEVELS[group.requiredValue] || 'Unknown')
                                                                    : 'Unknown';
                                                                let actualLevel: string;
                                                                if (group.worstActualValue === -2) {
                                                                    actualLevel = 'N/A';
                                                                } else if (group.worstActualValue >= 0) {
                                                                    actualLevel = PROFICIENCY_LEVELS[group.worstActualValue] || 'Unknown';
                                                                } else {
                                                                    actualLevel = 'Unknown';
                                                                }
                                                                
                                                                return (
                                                                    <TableRow 
                                                                        key={groupIndex} 
                                                                        className="border-b border-gray-100"
                                                                        data-testid={`row-requirement-${categoryIndex}-${groupIndex}`}
                                                                    >
                                                                        <TableCell className="text-xs text-gray-600">
                                                                            <HoverCard openDelay={200} closeDelay={100}>
                                                                                <HoverCardTrigger asChild>
                                                                                    <span className="cursor-pointer hover:text-blue-600">
                                                                                        {group.label}
                                                                                    </span>
                                                                                </HoverCardTrigger>
                                                                                <HoverCardContent className="w-80 p-0" align="start">
                                                                                    <div className="p-3 bg-gray-50 border-b">
                                                                                        <p className="text-xs font-medium text-gray-700">Individual Officer Breakdown</p>
                                                                                    </div>
                                                                                    <Table>
                                                                                        <TableHeader>
                                                                                            <TableRow className="bg-gray-50/50">
                                                                                                <TableHead className="text-xs font-medium text-gray-600 py-2">Rank Pair</TableHead>
                                                                                                <TableHead className="text-xs font-medium text-gray-600 py-2 text-center">Required</TableHead>
                                                                                                <TableHead className="text-xs font-medium text-gray-600 py-2 text-center">Actual</TableHead>
                                                                                            </TableRow>
                                                                                        </TableHeader>
                                                                                        <TableBody>
                                                                                            {group.individualResults.map((indiv, indivIndex) => {
                                                                                                const indivRequired = indiv.requiredValue >= 0 
                                                                                                    ? (PROFICIENCY_LEVELS[indiv.requiredValue] || 'Unknown')
                                                                                                    : 'Unknown';
                                                                                                let indivActual: string;
                                                                                                if (indiv.actualValue === -2) {
                                                                                                    indivActual = 'N/A';
                                                                                                } else if (indiv.actualValue >= 0) {
                                                                                                    indivActual = PROFICIENCY_LEVELS[indiv.actualValue] || 'Unknown';
                                                                                                } else {
                                                                                                    indivActual = 'Unknown';
                                                                                                }
                                                                                                return (
                                                                                                    <TableRow key={indivIndex} className="border-b border-gray-100">
                                                                                                        <TableCell className="text-xs text-gray-700 py-2">{indiv.rankPair}</TableCell>
                                                                                                        <TableCell className="text-xs text-gray-700 py-2 text-center">{indivRequired}</TableCell>
                                                                                                        <TableCell className="text-xs text-gray-700 py-2 text-center">{indivActual}</TableCell>
                                                                                                    </TableRow>
                                                                                                );
                                                                                            })}
                                                                                        </TableBody>
                                                                                    </Table>
                                                                                </HoverCardContent>
                                                                            </HoverCard>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-gray-700 text-center">
                                                                            {requiredLevel}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-gray-700 text-center">
                                                                            {actualLevel}
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            <div className="flex justify-center">
                                                                                <StatusDot status={group.overallStatus} />
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })
                                                        ) : (
                                                            // Render standard requirements rows with hover on description showing rank pair
                                                            requirements.map((req, reqIndex) => (
                                                                <TableRow 
                                                                    key={reqIndex} 
                                                                    className="border-b border-gray-100"
                                                                    data-testid={`row-requirement-${categoryIndex}-${reqIndex}`}
                                                                >
                                                                    <TableCell className="text-xs text-gray-600">
                                                                        <HoverCard openDelay={200} closeDelay={100}>
                                                                            <HoverCardTrigger asChild>
                                                                                <span className="cursor-pointer hover:text-blue-600">
                                                                                    {req.label}
                                                                                </span>
                                                                            </HoverCardTrigger>
                                                                            <HoverCardContent className="w-64 p-3" align="start">
                                                                                <p className="text-xs font-medium text-gray-700 mb-1">Rank Pair</p>
                                                                                <p className="text-xs text-gray-600">{req.rankPair}</p>
                                                                            </HoverCardContent>
                                                                        </HoverCard>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700 text-center">
                                                                        {formatRequirementValue(req).required}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700 text-center">
                                                                        {formatRequirementValue(req).actual}
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex justify-center">
                                                                            <StatusDot status={req.status} />
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
