import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComplianceMatrixDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Mock data - will be configurable in admin later
const oilMajors = [
    { id: 'adnoc', name: 'ADNOC', status: 'green' },
    { id: 'bhp', name: 'BHP', status: 'green' },
    { id: 'bp', name: 'BP', status: 'yellow' },
    { id: 'chevron', name: 'Chevron', status: 'red' },
    { id: 'conoco', name: 'Conoco', status: 'yellow' },
    { id: 'enel', name: 'Enel', status: 'yellow' },
    { id: 'eni', name: 'ENI', status: 'green' },
    { id: 'erg', name: 'Erg', status: 'red' },
    { id: 'international-energy', name: 'International Energy', status: 'red' },
    { id: 'idemitsu', name: 'Idemitsu', status: 'yellow' },
    { id: 'talisman', name: 'Talisman', status: 'yellow' },
    { id: 'koch', name: 'Koch', status: 'yellow' },
    { id: 'kpi', name: 'KPI', status: 'green' },
    { id: 'lukoil', name: 'Lukoil', status: 'red' },
];

// Mock requirements data
const requirementsByMajor: Record<string, any[]> = {
    'bp': [
        {
            category: 'Years with Operator',
            requirements: [
                {
                    description: 'Combined aggregate for master and C/O shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '23.1 Years',
                    status: 'green'
                },
                {
                    description: 'Combined aggregate for C/E and 2/E shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '11.0 Years',
                    status: 'green'
                }
            ]
        },
        {
            category: 'Years in Rank',
            requirements: [
                {
                    description: 'Combined aggregate for master and C/O shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '23.1 Years',
                    status: 'green'
                },
                {
                    description: 'Combined aggregate for C/E and 2/E shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '11.0 Years',
                    status: 'red'
                },
                {
                    description: 'Combined aggregate for C/E and 2/E shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '11.0 Years',
                    status: 'red'
                },
                {
                    description: 'Combined aggregate for C/E and 2/E shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '11.0 Years',
                    status: 'green'
                }
            ]
        },
        {
            category: 'Years on All Types of Tankers',
            requirements: [
                {
                    description: 'Combined aggregate for master and C/O shall not be less than 2 years.',
                    reqValue: '',
                    matrixValue: '',
                    status: 'green'
                },
                {
                    description: 'Combined aggregate for C/E and 2/E shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '11.0 Years',
                    status: 'green'
                },
                {
                    description: 'Combined aggregate for C/E and 2/E shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '11.0 Years',
                    status: 'green'
                },
                {
                    description: 'Combined aggregate for C/E and 2/E shall not be less than 2 years.',
                    reqValue: '2.0 Years',
                    matrixValue: '11.0 Years',
                    status: 'yellow'
                }
            ]
        },
        {
            category: 'Date Joined',
            requirements: [
                {
                    description: 'A minimum of 14 days shall lapse between replacement of the master and chief officer',
                    reqValue: '',
                    matrixValue: '',
                    status: 'green'
                },
                {
                    description: 'A minimum of 14 days shall lapse between replacement of the Chief Engineer and Second Engineer',
                    reqValue: '',
                    matrixValue: '',
                    status: 'green'
                },
                {
                    description: '',
                    reqValue: '',
                    matrixValue: '',
                    status: 'green'
                },
                {
                    description: '',
                    reqValue: '',
                    matrixValue: '',
                    status: 'green'
                }
            ]
        }
    ],
    'adnoc': [
        {
            category: 'Years with Operator',
            requirements: [
                {
                    description: 'Combined aggregate for master and C/O shall not be less than 3 years.',
                    reqValue: '3.0 Years',
                    matrixValue: '23.1 Years',
                    status: 'green'
                }
            ]
        }
    ],
    'bhp': [
        {
            category: 'Years in Rank',
            requirements: [
                {
                    description: 'Master shall have minimum 2 years experience.',
                    reqValue: '2.0 Years',
                    matrixValue: '15.0 Years',
                    status: 'green'
                }
            ]
        }
    ]
};

// Status dot component
const StatusDot = ({ status }: { status: 'green' | 'yellow' | 'red' }) => {
    const colors = {
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500'
    };
    
    return (
        <div className={`w-3 h-3 rounded-full ${colors[status]}`} data-testid={`status-${status}`}></div>
    );
};

export const ComplianceMatrixDialog: React.FC<ComplianceMatrixDialogProps> = ({
    open,
    onOpenChange
}) => {
    const [selectedMajor, setSelectedMajor] = useState(oilMajors[2]); // Default to BP (as shown in image)
    
    const currentRequirements = requirementsByMajor[selectedMajor.id] || [];
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200">
                    <DialogTitle className="text-lg font-medium text-[#16569e]">
                        Compliance Matrix
                    </DialogTitle>
                </DialogHeader>

                <div className="flex h-[calc(90vh-120px)]">
                    {/* Left Table - Oil Majors List */}
                    <div className="w-64 border-r border-gray-200 flex flex-col">
                        <ScrollArea className="flex-1">
                            <Table>
                                <TableBody>
                                    {oilMajors.map((major) => (
                                        <TableRow
                                            key={major.id}
                                            className={`cursor-pointer hover:bg-gray-50 ${
                                                selectedMajor.id === major.id ? 'bg-blue-50' : ''
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
                    </div>

                    {/* Right Table - Requirements */}
                    <div className="flex-1 flex flex-col">
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700" data-testid="text-requirements-for">
                                Requirements For: {selectedMajor.name}
                            </h3>
                        </div>
                        
                        <ScrollArea className="flex-1">
                            <div className="px-6 py-4">
                                {currentRequirements.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8">
                                        No requirements configured for {selectedMajor.name}
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {currentRequirements.map((category, categoryIndex) => (
                                            <div key={categoryIndex}>
                                                {/* Category Header */}
                                                {category.category && (
                                                    <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                                        {category.category}
                                                    </h4>
                                                )}
                                                
                                                {/* Requirements Table */}
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-gray-50">
                                                            <TableHead className="text-xs font-medium text-gray-700 w-[45%]">
                                                                {/* Empty header for description */}
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[20%]">
                                                                Req. Value
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[20%]">
                                                                Matrix Value
                                                            </TableHead>
                                                            <TableHead className="text-xs font-medium text-gray-700 text-center w-[15%]">
                                                                {/* Empty header for status */}
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {category.requirements.map((req: any, reqIndex: number) => (
                                                            <TableRow 
                                                                key={reqIndex} 
                                                                className="border-b border-gray-100"
                                                                data-testid={`row-requirement-${categoryIndex}-${reqIndex}`}
                                                            >
                                                                <TableCell className="text-xs text-gray-700 py-3">
                                                                    {req.description}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 text-center">
                                                                    {req.reqValue}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 text-center">
                                                                    {req.matrixValue}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {req.status && (
                                                                        <div className="flex justify-center">
                                                                            <StatusDot status={req.status as 'green' | 'yellow' | 'red'} />
                                                                        </div>
                                                                    )}
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
