/**
 * Allotments Manager - Manage crew allotments and beneficiaries
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Users,
  CreditCard,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Copy,
  FileCheck,
  Download,
  Upload,
  Filter
} from "lucide-react";

interface AllotmentsManagerProps {
  payRunId: string | null;
  onNavigate: (view: string, payRunId?: string, crewId?: string) => void;
}

interface Allotment {
  id: string;
  crewId: string;
  crewName: string;
  rank: string;
  beneficiaryName: string;
  relationship: string;
  percentage?: number;
  fixedAmount?: number;
  currency: string;
  bankName: string;
  iban: string;
  swift: string;
  priority: number;
  effectiveDate: string;
  endDate?: string;
  kycStatus: "verified" | "pending" | "failed";
}

export function AllotmentsManager({ payRunId, onNavigate }: AllotmentsManagerProps) {
  const [selectedVessel, setSelectedVessel] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedAllotment, setSelectedAllotment] = useState<Allotment | null>(null);

  // Mock allotments data
  const mockAllotments: Allotment[] = [
    {
      id: "AL001",
      crewId: "CR001",
      crewName: "John Smith",
      rank: "Captain",
      beneficiaryName: "Jane Smith",
      relationship: "Spouse",
      percentage: 50,
      currency: "USD",
      bankName: "Bank of America",
      iban: "US12345678901234567890",
      swift: "BOFAUS3N",
      priority: 1,
      effectiveDate: "2024-01-01",
      kycStatus: "verified"
    },
    {
      id: "AL002",
      crewId: "CR001",
      crewName: "John Smith",
      rank: "Captain",
      beneficiaryName: "Michael Smith",
      relationship: "Son",
      fixedAmount: 1000,
      currency: "USD",
      bankName: "Chase Bank",
      iban: "US09876543210987654321",
      swift: "CHASUS33",
      priority: 2,
      effectiveDate: "2024-01-01",
      kycStatus: "verified"
    },
    {
      id: "AL003",
      crewId: "CR002",
      crewName: "Mary Johnson",
      rank: "Chief Engineer",
      beneficiaryName: "Robert Johnson",
      relationship: "Spouse",
      percentage: 60,
      currency: "USD",
      bankName: "Wells Fargo",
      iban: "US11223344556677889900",
      swift: "WFBIUS6S",
      priority: 1,
      effectiveDate: "2024-03-01",
      kycStatus: "pending"
    },
    {
      id: "AL004",
      crewId: "CR003",
      crewName: "Robert Chen",
      rank: "2nd Officer",
      beneficiaryName: "Lisa Chen",
      relationship: "Spouse",
      percentage: 40,
      currency: "USD",
      bankName: "HSBC",
      iban: "US99887766554433221100",
      swift: "MRMDUS33",
      priority: 1,
      effectiveDate: "2024-06-01",
      kycStatus: "verified"
    }
  ];

  const filteredAllotments = mockAllotments.filter(allotment =>
    (allotment.crewName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     allotment.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-red-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleEditAllotment = (allotment: Allotment) => {
    setSelectedAllotment(allotment);
    setIsEditDrawerOpen(true);
  };

  // Group allotments by crew
  const groupedAllotments = filteredAllotments.reduce((acc, allotment) => {
    if (!acc[allotment.crewId]) {
      acc[allotment.crewId] = {
        crewName: allotment.crewName,
        rank: allotment.rank,
        allotments: []
      };
    }
    acc[allotment.crewId].allotments.push(allotment);
    return acc;
  }, {} as Record<string, { crewName: string; rank: string; allotments: Allotment[] }>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('detail', payRunId || undefined)}>
              ← Back to Pay Run
            </Button>
            <div>
              <h2 className="text-xl font-semibold">Allotments Manager</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">January 2025</Badge>
                <Badge>MV Atlantic Explorer</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy from Template
            </Button>
            <Button variant="outline">
              <FileCheck className="h-4 w-4 mr-2" />
              Validate Banks
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Allotment
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              <SelectItem value="mv-atlantic">MV Atlantic Explorer</SelectItem>
              <SelectItem value="mv-pacific">MV Pacific Voyager</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative flex-1 max-w-md">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search crew or beneficiary..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Crew Allotments</CardTitle>
              <div className="text-sm text-gray-600">
                {Object.keys(groupedAllotments).length} crew members, {filteredAllotments.length} allotments
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Crew</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>KYC Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedAllotments).map(([crewId, crew]) => (
                  <React.Fragment key={crewId}>
                    {crew.allotments.map((allotment, index) => (
                      <TableRow key={allotment.id}>
                        {index === 0 && (
                          <TableCell rowSpan={crew.allotments.length} className="font-medium align-top">
                            <div>
                              <div>{crew.crewName}</div>
                              <Badge variant="outline" className="mt-1 text-xs">
                                {crew.rank}
                              </Badge>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>{allotment.beneficiaryName}</TableCell>
                        <TableCell>{allotment.relationship}</TableCell>
                        <TableCell>
                          {allotment.percentage ? `${allotment.percentage}%` : 
                           allotment.fixedAmount ? `$${allotment.fixedAmount}` : '-'}
                        </TableCell>
                        <TableCell>{allotment.currency}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{allotment.bankName}</div>
                            <div className="text-xs text-gray-500">{allotment.swift}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{allotment.priority}</Badge>
                        </TableCell>
                        <TableCell>{allotment.effectiveDate}</TableCell>
                        <TableCell>{getKycStatusBadge(allotment.kycStatus)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAllotment(allotment)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Beneficiary Drawer */}
      <Sheet open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Edit Beneficiary</SheetTitle>
            <SheetDescription>
              Update beneficiary details and bank information
            </SheetDescription>
          </SheetHeader>
          {selectedAllotment && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Beneficiary Name</label>
                <Input defaultValue={selectedAllotment.beneficiaryName} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Relationship</label>
                <Select defaultValue={selectedAllotment.relationship}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select defaultValue={selectedAllotment.percentage ? "percentage" : "fixed"}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <Input 
                    defaultValue={selectedAllotment.percentage || selectedAllotment.fixedAmount} 
                    className="mt-1" 
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Bank Name</label>
                <Input defaultValue={selectedAllotment.bankName} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">IBAN</label>
                <Input defaultValue={selectedAllotment.iban} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">SWIFT Code</label>
                <Input defaultValue={selectedAllotment.swift} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Priority Order</label>
                <Input type="number" defaultValue={selectedAllotment.priority} className="mt-1" />
              </div>
              
              <div className="pt-4 flex gap-2">
                <Button className="flex-1">Save Changes</Button>
                <Button variant="outline" className="flex-1" onClick={() => setIsEditDrawerOpen(false)}>
                  Cancel
                </Button>
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm font-medium mb-2">KYC Verification</div>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">KYC Verified on Jan 5, 2025</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Footer */}
      <div className="border-t bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Total allotments value: $45,000 USD
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}