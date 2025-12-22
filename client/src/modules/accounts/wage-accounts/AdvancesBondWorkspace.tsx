/**
 * Advances & Bond Workspace
 * Purpose: Cash to Master, petty cash, bond purchases
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DollarSign, 
  Plus, 
  Upload, 
  FileCheck,
  Calendar,
  Ship,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  CreditCard,
  ShoppingCart,
  Banknote,
  TrendingUp,
  Filter
} from "lucide-react";

interface Advance {
  id: string;
  crewId: string;
  crewName: string;
  rank: string;
  amount: number;
  currency: string;
  reason: string;
  requestDate: string;
  approver: string;
  status: "pending" | "approved" | "rejected" | "disbursed" | "recovered";
  capCheck: boolean;
  remainingCap: number;
  recoveryAmount?: number;
  ctmReference?: string;
}

interface BondItem {
  id: string;
  crewId: string;
  crewName: string;
  itemName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  saleDate: string;
  autoDeduct: boolean;
  deductionAmount?: number;
  status: "pending" | "deducted" | "cancelled";
}

interface BondPriceItem {
  id: string;
  category: string;
  itemName: string;
  unitPrice: number;
  currency: string;
  lastUpdated: string;
}

// Mock data
const mockAdvances: Advance[] = [
  {
    id: "ADV001",
    crewId: "CREW001",
    crewName: "James Wilson",
    rank: "Captain",
    amount: 500,
    currency: "USD",
    reason: "Emergency medical expenses",
    requestDate: "2025-01-10",
    approver: "Fleet Manager",
    status: "approved",
    capCheck: true,
    remainingCap: 1500,
    ctmReference: "CTM-2025-001"
  },
  {
    id: "ADV002",
    crewId: "CREW002",
    crewName: "Sarah Chen",
    rank: "Chief Engineer",
    amount: 300,
    currency: "USD",
    reason: "Personal emergency",
    requestDate: "2025-01-08",
    approver: "Captain",
    status: "disbursed",
    capCheck: true,
    remainingCap: 700,
    recoveryAmount: 100
  },
  {
    id: "ADV003",
    crewId: "CREW003",
    crewName: "Mike Rodriguez",
    rank: "Second Officer",
    amount: 200,
    currency: "USD",
    reason: "Family support",
    requestDate: "2025-01-05",
    approver: "Captain",
    status: "recovered",
    capCheck: true,
    remainingCap: 800,
    recoveryAmount: 200
  }
];

const mockBondItems: BondItem[] = [
  {
    id: "BOND001",
    crewId: "CREW001",
    crewName: "James Wilson",
    itemName: "Cigarettes - Marlboro",
    category: "Tobacco",
    quantity: 2,
    unitPrice: 45.00,
    totalPrice: 90.00,
    currency: "USD",
    saleDate: "2025-01-10",
    autoDeduct: true,
    deductionAmount: 90.00,
    status: "deducted"
  },
  {
    id: "BOND002",
    crewId: "CREW002",
    crewName: "Sarah Chen",
    itemName: "Perfume - Chanel",
    category: "Cosmetics",
    quantity: 1,
    unitPrice: 120.00,
    totalPrice: 120.00,
    currency: "USD",
    saleDate: "2025-01-08",
    autoDeduct: true,
    deductionAmount: 120.00,
    status: "pending"
  },
  {
    id: "BOND003",
    crewId: "CREW003",
    crewName: "Mike Rodriguez",
    itemName: "Whiskey - Johnnie Walker",
    category: "Alcohol",
    quantity: 1,
    unitPrice: 75.00,
    totalPrice: 75.00,
    currency: "USD",
    saleDate: "2025-01-05",
    autoDeduct: false,
    status: "cancelled"
  }
];

const mockBondPrices: BondPriceItem[] = [
  { id: "BP001", category: "Tobacco", itemName: "Cigarettes - Marlboro", unitPrice: 45.00, currency: "USD", lastUpdated: "2025-01-01" },
  { id: "BP002", category: "Alcohol", itemName: "Whiskey - Johnnie Walker", unitPrice: 75.00, currency: "USD", lastUpdated: "2025-01-01" },
  { id: "BP003", category: "Cosmetics", itemName: "Perfume - Chanel", unitPrice: 120.00, currency: "USD", lastUpdated: "2025-01-01" },
  { id: "BP004", category: "Electronics", itemName: "Headphones - Sony", unitPrice: 85.00, currency: "USD", lastUpdated: "2025-01-01" }
];

export function AdvancesBondWorkspace() {
  const [activeTab, setActiveTab] = useState("advances");
  const [isNewAdvanceOpen, setIsNewAdvanceOpen] = useState(false);
  const [isImportBondOpen, setIsImportBondOpen] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState("mv-atlantic-star");
  const [selectedMonth, setSelectedMonth] = useState("2025-01");
  const [selectedAdvanceCap, setSelectedAdvanceCap] = useState("2000");
  const [newAdvanceData, setNewAdvanceData] = useState({
    crewId: "",
    amount: "",
    currency: "USD",
    reason: ""
  });

  const advanceCap = 2000; // Monthly advance cap
  const totalAdvances = mockAdvances.reduce((sum, adv) => 
    adv.status !== "recovered" && adv.status !== "rejected" ? sum + adv.amount : sum, 0
  );
  const totalBondSales = mockBondItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleNewAdvance = () => {
    console.log("Creating new advance:", newAdvanceData);
    setIsNewAdvanceOpen(false);
    setNewAdvanceData({ crewId: "", amount: "", currency: "USD", reason: "" });
  };

  const handleImportBondSales = () => {
    console.log("Importing bond sales");
    setIsImportBondOpen(false);
  };

  const handleReconcileSignOff = () => {
    console.log("Reconciling at sign off");
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, label: "Pending", icon: Clock },
      approved: { variant: "default" as const, label: "Approved", icon: CheckCircle },
      rejected: { variant: "destructive" as const, label: "Rejected", icon: XCircle },
      disbursed: { variant: "default" as const, label: "Disbursed", icon: Banknote },
      recovered: { variant: "outline" as const, label: "Recovered", icon: TrendingUp },
      deducted: { variant: "default" as const, label: "Deducted", icon: CheckCircle },
      cancelled: { variant: "destructive" as const, label: "Cancelled", icon: XCircle }
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
            <h1 className="text-2xl font-bold text-gray-900">Advances & Bond</h1>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <Dialog open={isNewAdvanceOpen} onOpenChange={setIsNewAdvanceOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1">
                  <Plus className="w-4 h-4" />
                  New Advance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request New Advance</DialogTitle>
                  <DialogDescription>
                    Create a new cash advance request with approval workflow
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Crew Member</Label>
                    <Select value={newAdvanceData.crewId} onValueChange={(value) => 
                      setNewAdvanceData({...newAdvanceData, crewId: value})
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select crew member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CREW001">James Wilson (Captain)</SelectItem>
                        <SelectItem value="CREW002">Sarah Chen (Chief Engineer)</SelectItem>
                        <SelectItem value="CREW003">Mike Rodriguez (Second Officer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Amount</Label>
                      <Input 
                        type="number"
                        placeholder="500"
                        value={newAdvanceData.amount}
                        onChange={(e) => setNewAdvanceData({...newAdvanceData, amount: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Select value={newAdvanceData.currency} onValueChange={(value) => 
                        setNewAdvanceData({...newAdvanceData, currency: value})
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input 
                      placeholder="Emergency medical expenses"
                      value={newAdvanceData.reason}
                      onChange={(e) => setNewAdvanceData({...newAdvanceData, reason: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleNewAdvance} className="flex-1">
                      Submit Request
                    </Button>
                    <Button variant="outline" onClick={() => setIsNewAdvanceOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isImportBondOpen} onOpenChange={setIsImportBondOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-1">
                  <Upload className="w-4 h-4" />
                  Import Bond Sales
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Bond Sales</DialogTitle>
                  <DialogDescription>
                    Upload bond sales data from POS system or manual entry
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-2">
                      Drop your CSV file here or click to browse
                    </p>
                    <Button variant="outline" size="sm">
                      Choose File
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500">
                    Expected format: Crew ID, Item Name, Quantity, Unit Price, Sale Date
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleImportBondSales} className="flex-1">
                      Import Sales
                    </Button>
                    <Button variant="outline" onClick={() => setIsImportBondOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleReconcileSignOff} className="gap-1">
              <FileCheck className="w-4 h-4" />
              Reconcile at Sign-Off
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

          <Select value={selectedAdvanceCap} onValueChange={setSelectedAdvanceCap}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Advance Cap" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1000">$1,000</SelectItem>
              <SelectItem value="2000">$2,000</SelectItem>
              <SelectItem value="3000">$3,000</SelectItem>
              <SelectItem value="5000">$5,000</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-white">
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="bond">Bond</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="advances" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Cash Advance Requests</span>
                  <Badge variant="outline">{mockAdvances.length} requests</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-9 gap-4 p-3 bg-gray-100 rounded-lg font-medium text-sm">
                    <div>Crew Member</div>
                    <div className="text-right">Amount</div>
                    <div>Currency</div>
                    <div>Reason</div>
                    <div className="text-center">Request Date</div>
                    <div>Approver</div>
                    <div className="text-center">Cap Check</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">CTM Link</div>
                  </div>

                  {/* Advance Rows */}
                  {mockAdvances.map((advance) => (
                    <div key={advance.id} className="grid grid-cols-9 gap-4 p-3 border rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="font-medium">{advance.crewName}</div>
                        <div className="text-sm text-gray-500">{advance.rank}</div>
                        <div className="text-xs text-gray-500">
                          Remaining: ${advance.remainingCap}
                        </div>
                      </div>
                      
                      <div className="text-right font-mono text-lg">
                        ${advance.amount.toLocaleString()}
                      </div>
                      
                      <div>{advance.currency}</div>
                      
                      <div className="text-sm">{advance.reason}</div>
                      
                      <div className="text-center text-sm">{advance.requestDate}</div>
                      
                      <div className="text-sm">{advance.approver}</div>
                      
                      <div className="text-center">
                        {advance.capCheck ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto" />
                        )}
                      </div>
                      
                      <div className="text-center">
                        {getStatusBadge(advance.status)}
                        {advance.recoveryAmount && (
                          <div className="text-xs text-gray-500 mt-1">
                            Recovered: ${advance.recoveryAmount}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-center">
                        {advance.ctmReference ? (
                          <Badge variant="outline" className="text-xs">
                            {advance.ctmReference}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Approval Rules */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">Approval Rules & Caps</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm text-blue-800">
                    <div>
                      <strong>Monthly Cap:</strong> $2,000 per crew member
                    </div>
                    <div>
                      <strong>Single Advance:</strong> Max $1,000 (Captain approval required)
                    </div>
                    <div>
                      <strong>Recovery:</strong> Auto-deduct from next payroll
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bond" className="space-y-4 m-0">
            {/* Bond Price List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Bond Price List
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  {mockBondPrices.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-xs text-gray-500 mb-2">{item.category}</div>
                      <div className="font-mono text-lg text-green-600">
                        ${item.unitPrice.toFixed(2)} {item.currency}
                      </div>
                      <div className="text-xs text-gray-500">
                        Updated: {item.lastUpdated}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bond Sales */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Bond Sales & Deductions</span>
                  <Badge variant="outline">{mockBondItems.length} sales</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-8 gap-4 p-3 bg-gray-100 rounded-lg font-medium text-sm">
                    <div>Crew Member</div>
                    <div>Item</div>
                    <div className="text-center">Qty</div>
                    <div className="text-right">Unit Price</div>
                    <div className="text-right">Total</div>
                    <div className="text-center">Sale Date</div>
                    <div className="text-center">Auto-Deduct</div>
                    <div className="text-center">Status</div>
                  </div>

                  {/* Bond Sales Rows */}
                  {mockBondItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-8 gap-4 p-3 border rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="font-medium">{item.crewName}</div>
                        <div className="text-sm text-gray-500">ID: {item.crewId}</div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-sm">{item.itemName}</div>
                        <div className="text-xs text-gray-500">{item.category}</div>
                      </div>
                      
                      <div className="text-center font-mono">{item.quantity}</div>
                      
                      <div className="text-right font-mono">
                        ${item.unitPrice.toFixed(2)}
                      </div>
                      
                      <div className="text-right font-mono font-bold text-green-600">
                        ${item.totalPrice.toFixed(2)}
                      </div>
                      
                      <div className="text-center text-sm">{item.saleDate}</div>
                      
                      <div className="text-center">
                        {item.autoDeduct ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400 mx-auto" />
                        )}
                        {item.deductionAmount && (
                          <div className="text-xs text-gray-500 mt-1">
                            ${item.deductionAmount}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-center">
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reconciliation Summary */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-3">Ledger Summary & Reconciliation</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">Total Sales:</span>
                      <div className="font-mono text-lg text-green-800">
                        ${totalBondSales.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-green-700">Auto-Deductions:</span>
                      <div className="font-mono text-lg text-green-800">
                        ${mockBondItems.filter(i => i.autoDeduct).reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-green-700">Manual Collections:</span>
                      <div className="font-mono text-lg text-green-800">
                        ${mockBondItems.filter(i => !i.autoDeduct).reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}