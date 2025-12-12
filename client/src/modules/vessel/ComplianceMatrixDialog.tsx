import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, Upload, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ComplianceMatrixDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vesselId?: string;
}

interface ComplianceRuleResult {
    category: string;
    label: string;
    rankPair: string;
    requiredValue: number;
    actualValue: number;
    unit: string;
    status: 'pass' | 'fail';
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

const StatusDot = ({ status }: { status: 'green' | 'yellow' | 'red' | 'pass' | 'fail' }) => {
    const colors = {
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
        pass: 'bg-green-500',
        fail: 'bg-red-500'
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
    // For other categories, show numeric value with unit
    return { 
        required: `${req.requiredValue} ${req.unit}`, 
        actual: `${req.actualValue} ${req.unit}` 
    };
}

export const ComplianceMatrixDialog: React.FC<ComplianceMatrixDialogProps> = ({
    open,
    onOpenChange,
    vesselId
}) => {
    const { toast } = useToast();
    const [selectedMajor, setSelectedMajor] = useState<{ id: number; name: string; status: string } | null>(null);
    const [selectedResult, setSelectedResult] = useState<ComplianceCheckResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const { data: oilMajorRules = [], isLoading: isLoadingRules, refetch: refetchRules } = useQuery<OilMajorRule[]>({
        queryKey: ['/api/oil-major-rules'],
        enabled: open
    });

    const { data: complianceData, isLoading: isLoadingCompliance } = useQuery<{ vesselId: string; results: ComplianceCheckResult[]; message?: string }>({
        queryKey: [`/api/compliance/matrix/${vesselId}`],
        enabled: open && !!vesselId && oilMajorRules.length > 0
    });

    const oilMajors = complianceData?.results?.map(result => ({
        id: oilMajorRules.find(r => r.oilMajorName === result.oilMajorName)?.id || 0,
        name: result.oilMajorName,
        status: result.overallStatus
    })) || [];

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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const content = await file.text();
            await apiRequest('POST', '/api/oil-major-rules/import-csv', { csvContent: content });
            
            toast({
                title: 'Import Successful',
                description: 'Oil major rules have been imported successfully.',
            });
            
            refetchRules();
        } catch (error) {
            toast({
                title: 'Import Failed',
                description: 'Failed to import oil major rules. Please check the file format.',
                variant: 'destructive'
            });
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };

    const groupedResults = selectedResult ? groupResultsByCategory(selectedResult.results) : {};
    const isLoading = isLoadingRules || isLoadingCompliance;
    const hasNoRules = oilMajorRules.length === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-medium text-[#16569e]">
                            Compliance Matrix
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                id="csv-upload"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={isImporting}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('csv-upload')?.click()}
                                disabled={isImporting}
                                data-testid="button-import-csv"
                            >
                                {isImporting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <FileUp className="w-4 h-4 mr-2" />
                                )}
                                Import Rules
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex h-[calc(90vh-120px)]">
                    {/* Left Table - Oil Majors List */}
                    <div className="w-64 border-r border-gray-200 flex flex-col">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : hasNoRules ? (
                            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                <AlertCircle className="w-10 h-10 text-gray-400 mb-3" />
                                <p className="text-sm text-gray-500 mb-2">No oil major rules configured</p>
                                <p className="text-xs text-gray-400">Import a CSV file to get started</p>
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
                                                        <StatusDot status={major.status as 'green' | 'yellow' | 'red'} />
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
                                            ? 'Import oil major rules to see compliance requirements'
                                            : `No requirements configured for ${selectedMajor?.name || 'this oil major'}`
                                        }
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(groupedResults).map(([category, requirements], categoryIndex) => (
                                            <div key={categoryIndex}>
                                                <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                                    {category}
                                                </h4>
                                                
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-gray-50">
                                                            <TableHead className="text-xs font-medium text-gray-700 w-[35%]">
                                                                Rank Pair
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 w-[25%]">
                                                                Description
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[15%]">
                                                                Required
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[15%]">
                                                                Actual
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[10%]">
                                                                Status
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {requirements.map((req, reqIndex) => (
                                                            <TableRow 
                                                                key={reqIndex} 
                                                                className="border-b border-gray-100"
                                                                data-testid={`row-requirement-${categoryIndex}-${reqIndex}`}
                                                            >
                                                                <TableCell className="text-xs text-gray-700 py-3">
                                                                    {req.rankPair}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-600">
                                                                    {req.label}
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
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ))}
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
