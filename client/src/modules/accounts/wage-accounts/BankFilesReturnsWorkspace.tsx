/**
 * Bank Files & Returns Workspace
 * Purpose: Create and track payment outputs
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Building2, 
  FileText, 
  Upload, 
  Download,
  Calendar,
  Ship,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  Eye,
  Edit,
  CreditCard,
  Users,
  DollarSign,
  ArrowUpRight,
  Filter
} from "lucide-react";

interface PaymentBatch {
  id: string;
  runId: string;
  runName: string;
  batchDate: string;
  allotmentsPayments: PaymentSection;
  netToCrewPayments: PaymentSection;
  ctmPayments: PaymentSection;
  totalAmount: number;
  currency: string;
  status: "draft" | "generated" | "sent" | "partial_returned" | "completed";
}

interface PaymentSection {
  count: number;
  amount: number;
  currency: string;
  bankTemplate: string;
  fileStatus: "pending" | "generated" | "sent" | "returned" | "failed";
  fileName?: string;
  generatedDate?: string;
  sentDate?: string;
  returnedDate?: string;
  failedCount?: number;
}

interface PaymentDetail {
  id: string;
  type: "allotment" | "net_crew" | "ctm";
  recipientName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  iban: string;
  amount: number;
  currency: string;
  status: "pending" | "sent" | "returned" | "failed";
  returnReason?: string;
  validationStatus: "valid" | "invalid" | "warning";
  validationMessages?: string[];
}

// Mock data
const mockPaymentBatches: PaymentBatch[] = [
  {
    id: "BATCH001",
    runId: "RUN2025001",
    runName: "January 2025 Payroll",
    batchDate: "2025-01-15",
    allotmentsPayments: {
      count: 12,
      amount: 45000,
      currency: "USD",
      bankTemplate: "SWIFT_MT103",
      fileStatus: "sent",
      fileName: "allotments_20250115.xml",
      generatedDate: "2025-01-15",
      sentDate: "2025-01-15"
    },
    netToCrewPayments: {
      count: 8,
      amount: 32000,
      currency: "USD", 
      bankTemplate: "SEPA_CT",
      fileStatus: "returned",
      fileName: "net_crew_20250115.xml",
      generatedDate: "2025-01-15",
      sentDate: "2025-01-15",
      returnedDate: "2025-01-16",
      failedCount: 2
    },
    ctmPayments: {
      count: 1,
      amount: 5000,
      currency: "USD",
      bankTemplate: "CASH_REQUEST",
      fileStatus: "generated",
      fileName: "ctm_20250115.xml",
      generatedDate: "2025-01-15"
    },
    totalAmount: 82000,
    currency: "USD",
    status: "partial_returned"
  }
];

const mockPaymentDetails: PaymentDetail[] = [
  {
    id: "PAY001",
    type: "allotment",
    recipientName: "Maria Wilson",
    accountNumber: "1234567890",
    bankName: "Chase Bank",
    swiftCode: "CHASUS33",
    iban: "US64CHASUS33123456789",
    amount: 3600,
    currency: "USD",
    status: "sent",
    validationStatus: "valid"
  },
  {
    id: "PAY002",
    type: "net_crew",
    recipientName: "James Wilson",
    accountNumber: "9876543210",
    bankName: "Wells Fargo",
    swiftCode: "WFBIUS6S",
    iban: "US29WFBI98765432109876543210",
    amount: 4200,
    currency: "USD",
    status: "returned",
    returnReason: "Invalid account number",
    validationStatus: "invalid",
    validationMessages: ["Account number format invalid", "IBAN checksum failed"]
  },
  {
    id: "PAY003",
    type: "ctm",
    recipientName: "MV Atlantic Star - Cash",
    accountNumber: "CASH001",
    bankName: "Ship Account",
    swiftCode: "SHIPXX",
    iban: "",
    amount: 5000,
    currency: "USD",
    status: "pending",
    validationStatus: "valid"
  }
];

const bankTemplates = [
  { id: "SWIFT_MT103", name: "SWIFT MT103", description: "International wire transfers" },
  { id: "SEPA_CT", name: "SEPA Credit Transfer", description: "European payments" },
  { id: "ACH_CT", name: "ACH Credit Transfer", description: "US domestic payments" },
  { id: "CASH_REQUEST", name: "Cash Request", description: "Cash to Master requests" }
];

export function BankFilesReturnsWorkspace() {
  const [selectedBatch, setSelectedBatch] = useState<PaymentBatch | null>(mockPaymentBatches[0]);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isUploadReturnOpen, setIsUploadReturnOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetail | null>(null);
  const [selectedVessel, setSelectedVessel] = useState("mv-atlantic-star");
  const [selectedMonth, setSelectedMonth] = useState("2025-01");
  const [generateConfig, setGenerateConfig] = useState({
    section: "",
    bankTemplate: ""
  });

  const handleGenerateFiles = () => {
    console.log("Generating payment files:", generateConfig);
    setIsGenerateDialogOpen(false);
  };

  const handleValidateIbanSwift = () => {
    console.log("Validating IBAN/SWIFT codes");
  };

  const handleMarkSent = (section: string) => {
    console.log(`Marking ${section} as sent`);
  };

  const handleUploadReturn = () => {
    console.log("Uploading bank return file");
    setIsUploadReturnOpen(false);
  };

  const handleReissueFailed = () => {
    console.log("Re-issuing failed payments");
  };

  const handleViewDetails = (payment: PaymentDetail) => {
    setSelectedPayment(payment);
    setIsDetailDrawerOpen(true);
  };

  const getFileStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, label: "Pending", icon: Clock },
      generated: { variant: "default" as const, label: "Generated", icon: FileText },
      sent: { variant: "default" as const, label: "Sent", icon: Send },
      returned: { variant: "destructive" as const, label: "Returned", icon: RefreshCw },
      failed: { variant: "destructive" as const, label: "Failed", icon: XCircle }
    };
    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getValidationBadge = (status: string) => {
    const variants = {
      valid: { variant: "default" as const, label: "Valid", icon: CheckCircle },
      invalid: { variant: "destructive" as const, label: "Invalid", icon: XCircle },
      warning: { variant: "secondary" as const, label: "Warning", icon: AlertTriangle }
    };
    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          {/* Left - Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank Files & Returns</h1>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1">
                  <FileText className="w-4 h-4" />
                  Generate Files
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Payment Files</DialogTitle>
                  <DialogDescription>
                    Select section and bank template to generate payment files
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Payment Section</Label>
                    <Select value={generateConfig.section} onValueChange={(value) => 
                      setGenerateConfig({...generateConfig, section: value})
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allotments">Allotments Payment</SelectItem>
                        <SelectItem value="net_crew">Net to Crew</SelectItem>
                        <SelectItem value="ctm">Cash to Master</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bank Template</Label>
                    <Select value={generateConfig.bankTemplate} onValueChange={(value) => 
                      setGenerateConfig({...generateConfig, bankTemplate: value})
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankTemplates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              <div className="text-xs text-gray-500">{template.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleGenerateFiles} className="flex-1">
                      Generate
                    </Button>
                    <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleValidateIbanSwift} className="gap-1">
              <CheckCircle className="w-4 h-4" />
              Validate IBAN/SWIFT
            </Button>

            <Dialog open={isUploadReturnOpen} onOpenChange={setIsUploadReturnOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-1">
                  <Upload className="w-4 h-4" />
                  Upload Returns
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Bank Return File</DialogTitle>
                  <DialogDescription>
                    Upload return file from bank with payment status updates
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-2">
                      Drop bank return file here or click to browse
                    </p>
                    <Button variant="outline" size="sm">
                      Choose File
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500">
                    Supported formats: XML, CSV, MT940, CAMT.054
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleUploadReturn} className="flex-1">
                      Upload & Process
                    </Button>
                    <Button variant="outline" onClick={() => setIsUploadReturnOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleReissueFailed} className="gap-1">
              <RefreshCw className="w-4 h-4" />
              Re-issue Failed
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-4">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mv-atlantic-star">MV Atlantic Star</SelectItem>
              <SelectItem value="mv-atlantic-explorer">MV Atlantic Explorer</SelectItem>
              <SelectItem value="mv-pacific-voyager">MV Pacific Voyager</SelectItem>
              <SelectItem value="mv-northern-star">MV Northern Star</SelectItem>
              <SelectItem value="mv-southern-cross">MV Southern Cross</SelectItem>
              <SelectItem value="mv-eastern-dawn">MV Eastern Dawn</SelectItem>
              <SelectItem value="mv-western-wind">MV Western Wind</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-01">January 2025</SelectItem>
              <SelectItem value="2024-12">December 2024</SelectItem>
              <SelectItem value="2024-11">November 2024</SelectItem>
              <SelectItem value="2024-10">October 2024</SelectItem>
              <SelectItem value="2024-09">September 2024</SelectItem>
              <SelectItem value="2024-08">August 2024</SelectItem>
            </SelectContent>
          </Select>

          <Filter className="w-4 h-4 text-gray-500" />
        </div>
      </div>

      {/* Payment Sections */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {selectedBatch && (
          <>
            {/* Allotments Payment Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>Allotments Payment (Beneficiaries)</span>
                  </div>
                  {getFileStatusBadge(selectedBatch.allotmentsPayments.fileStatus)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedBatch.allotmentsPayments.count}
                    </div>
                    <div className="text-sm text-gray-600">Count</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${selectedBatch.allotmentsPayments.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Amount</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedBatch.allotmentsPayments.currency}
                    </div>
                    <div className="text-sm text-gray-600">Currency</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-900">
                      {selectedBatch.allotmentsPayments.bankTemplate}
                    </div>
                    <div className="text-sm text-gray-600">Bank Template</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-900">
                      {selectedBatch.allotmentsPayments.fileName || "—"}
                    </div>
                    <div className="text-sm text-gray-600">File Name</div>
                  </div>
                  <div className="text-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleMarkSent("allotments")}
                      disabled={selectedBatch.allotmentsPayments.fileStatus === "sent"}
                    >
                      Mark Sent
                    </Button>
                  </div>
                </div>
                
                {selectedBatch.allotmentsPayments.sentDate && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    Generated: {selectedBatch.allotmentsPayments.generatedDate} | 
                    Sent: {selectedBatch.allotmentsPayments.sentDate}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Net to Crew Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    <span>Net to Crew (Personal Accounts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getFileStatusBadge(selectedBatch.netToCrewPayments.fileStatus)}
                    {selectedBatch.netToCrewPayments.failedCount && (
                      <Badge variant="destructive">
                        {selectedBatch.netToCrewPayments.failedCount} Failed
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedBatch.netToCrewPayments.count}
                    </div>
                    <div className="text-sm text-gray-600">Count</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${selectedBatch.netToCrewPayments.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Amount</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedBatch.netToCrewPayments.currency}
                    </div>
                    <div className="text-sm text-gray-600">Currency</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-900">
                      {selectedBatch.netToCrewPayments.bankTemplate}
                    </div>
                    <div className="text-sm text-gray-600">Bank Template</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-900">
                      {selectedBatch.netToCrewPayments.fileName || "—"}
                    </div>
                    <div className="text-sm text-gray-600">File Name</div>
                  </div>
                  <div className="text-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleMarkSent("net_crew")}
                      disabled={selectedBatch.netToCrewPayments.fileStatus === "sent"}
                    >
                      Mark Sent
                    </Button>
                  </div>
                </div>
                
                {selectedBatch.netToCrewPayments.returnedDate && (
                  <div className="text-xs text-gray-500 bg-red-50 p-2 rounded">
                    Generated: {selectedBatch.netToCrewPayments.generatedDate} | 
                    Sent: {selectedBatch.netToCrewPayments.sentDate} | 
                    Returned: {selectedBatch.netToCrewPayments.returnedDate} | 
                    Failed: {selectedBatch.netToCrewPayments.failedCount} payments
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CTM Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    <span>Cash to Master (CTM)</span>
                  </div>
                  {getFileStatusBadge(selectedBatch.ctmPayments.fileStatus)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedBatch.ctmPayments.count}
                    </div>
                    <div className="text-sm text-gray-600">Count</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${selectedBatch.ctmPayments.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Amount</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedBatch.ctmPayments.currency}
                    </div>
                    <div className="text-sm text-gray-600">Currency</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-900">
                      {selectedBatch.ctmPayments.bankTemplate}
                    </div>
                    <div className="text-sm text-gray-600">Bank Template</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-900">
                      {selectedBatch.ctmPayments.fileName || "—"}
                    </div>
                    <div className="text-sm text-gray-600">File Name</div>
                  </div>
                  <div className="text-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleMarkSent("ctm")}
                      disabled={selectedBatch.ctmPayments.fileStatus === "sent"}
                    >
                      Mark Sent
                    </Button>
                  </div>
                </div>
                
                {selectedBatch.ctmPayments.generatedDate && (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    Generated: {selectedBatch.ctmPayments.generatedDate}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Details Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-8 gap-4 p-3 bg-gray-100 rounded-lg font-medium text-sm">
                    <div>Type</div>
                    <div>Recipient</div>
                    <div>Account</div>
                    <div>Bank</div>
                    <div className="text-right">Amount</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Validation</div>
                    <div className="text-center">Actions</div>
                  </div>
                  
                  {mockPaymentDetails.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-8 gap-4 p-3 border rounded-lg hover:bg-gray-50">
                      <div>
                        <Badge variant="outline" className="text-xs">
                          {payment.type === "allotment" ? "Allotment" : 
                           payment.type === "net_crew" ? "Net Crew" : "CTM"}
                        </Badge>
                      </div>
                      
                      <div>
                        <div className="font-medium text-sm">{payment.recipientName}</div>
                        {payment.returnReason && (
                          <div className="text-xs text-red-600">{payment.returnReason}</div>
                        )}
                      </div>
                      
                      <div className="text-sm">
                        <div>{payment.accountNumber}</div>
                        {payment.iban && (
                          <div className="text-xs text-gray-500">{payment.iban}</div>
                        )}
                      </div>
                      
                      <div className="text-sm">
                        <div>{payment.bankName}</div>
                        <div className="text-xs text-gray-500">{payment.swiftCode}</div>
                      </div>
                      
                      <div className="text-right font-mono">
                        ${payment.amount.toLocaleString()}
                      </div>
                      
                      <div className="text-center">
                        {getFileStatusBadge(payment.status)}
                      </div>
                      
                      <div className="text-center">
                        {getValidationBadge(payment.validationStatus)}
                      </div>
                      
                      <div className="text-center">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewDetails(payment)}
                          className="gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Payment Detail Drawer */}
      <Sheet open={isDetailDrawerOpen} onOpenChange={setIsDetailDrawerOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>Payment Details</SheetTitle>
            <SheetDescription>
              View and edit payment information, handle returns
            </SheetDescription>
          </SheetHeader>
          
          {selectedPayment && (
            <div className="mt-6 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Payment Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Type</Label>
                      <div className="font-medium">{selectedPayment.type}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Status</Label>
                      <div className="mt-1">{getFileStatusBadge(selectedPayment.status)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Amount</Label>
                      <div className="font-mono text-lg">${selectedPayment.amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Currency</Label>
                      <div className="font-medium">{selectedPayment.currency}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Recipient Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Recipient Name</Label>
                    <Input value={selectedPayment.recipientName} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Account Number</Label>
                      <Input value={selectedPayment.accountNumber} />
                    </div>
                    <div>
                      <Label className="text-xs">Bank Name</Label>
                      <Input value={selectedPayment.bankName} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">SWIFT Code</Label>
                      <Input value={selectedPayment.swiftCode} />
                    </div>
                    <div>
                      <Label className="text-xs">IBAN</Label>
                      <Input value={selectedPayment.iban} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Validation Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Validation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <span>Overall Status</span>
                    {getValidationBadge(selectedPayment.validationStatus)}
                  </div>
                  
                  {selectedPayment.validationMessages && (
                    <div className="space-y-2">
                      {selectedPayment.validationMessages.map((message, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <span>{message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Return Information */}
              {selectedPayment.status === "returned" && selectedPayment.returnReason && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-red-700">Return Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Return Reason</Label>
                        <div className="text-sm text-red-600 mt-1">
                          {selectedPayment.returnReason}
                        </div>
                      </div>
                      <Button className="w-full gap-1">
                        <RefreshCw className="w-4 h-4" />
                        Re-queue Payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 gap-1">
                  <Edit className="w-4 h-4" />
                  Edit Details
                </Button>
                <Button onClick={() => setIsDetailDrawerOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}