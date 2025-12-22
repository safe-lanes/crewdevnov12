/**
 * Validation Centre Workspace
 * Purpose: One queue to resolve issues blocking approval
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink,
  User,
  DollarSign,
  TrendingDown,
  CreditCard,
  Globe,
  Database,
  ChevronRight,
  AlertCircle
} from "lucide-react";

interface ValidationIssue {
  id: string;
  type: "missing-data" | "rate-not-found" | "negative-net" | "over-caps" | "returned-payments" | "fx-missing";
  severity: "high" | "medium" | "low";
  crewName: string;
  crewId: string;
  runId: string;
  element: string;
  description: string;
  amount?: number;
  currency?: string;
  canBulkResolve: boolean;
}

interface ValidationBucket {
  type: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  color: string;
}

// Mock validation issues data
const mockIssues: ValidationIssue[] = [
  {
    id: "V001",
    type: "missing-data",
    severity: "high",
    crewName: "James Wilson",
    crewId: "CREW001",
    runId: "PR-2025-001",
    element: "Bank Details",
    description: "Missing IBAN for salary payment",
    canBulkResolve: false
  },
  {
    id: "V002",
    type: "rate-not-found",
    severity: "medium",
    crewName: "Sarah Chen",
    crewId: "CREW002",
    runId: "PR-2025-001",
    element: "Overtime Rate",
    description: "No overtime rate defined for Chief Engineer rank",
    canBulkResolve: true
  },
  {
    id: "V003",
    type: "negative-net",
    severity: "high",
    crewName: "Mike Rodriguez",
    crewId: "CREW003",
    runId: "PR-2025-001",
    element: "Net Pay",
    description: "Net pay is negative due to excessive deductions",
    amount: -125.50,
    currency: "USD",
    canBulkResolve: false
  },
  {
    id: "V004",
    type: "over-caps",
    severity: "medium",
    crewName: "Anna Kowalski",
    crewId: "CREW004",
    runId: "PR-2025-001",
    element: "Overtime Hours",
    description: "Overtime hours exceed monthly cap of 80 hours",
    amount: 95.5,
    canBulkResolve: false
  },
  {
    id: "V005",
    type: "fx-missing",
    severity: "low",
    crewName: "Carlos Santos",
    crewId: "CREW005",
    runId: "PR-2025-001",
    element: "Exchange Rate",
    description: "Missing EUR/USD exchange rate for January 15",
    canBulkResolve: true
  }
];

const validationBuckets: ValidationBucket[] = [
  {
    type: "missing-data",
    label: "Missing Master Data",
    icon: <Database className="w-4 h-4" />,
    count: mockIssues.filter(i => i.type === "missing-data").length,
    color: "bg-red-500"
  },
  {
    type: "rate-not-found",
    label: "Rate Not Found",
    icon: <DollarSign className="w-4 h-4" />,
    count: mockIssues.filter(i => i.type === "rate-not-found").length,
    color: "bg-orange-500"
  },
  {
    type: "negative-net",
    label: "Negative Net",
    icon: <TrendingDown className="w-4 h-4" />,
    count: mockIssues.filter(i => i.type === "negative-net").length,
    color: "bg-red-600"
  },
  {
    type: "over-caps",
    label: "Over Caps",
    icon: <AlertTriangle className="w-4 h-4" />,
    count: mockIssues.filter(i => i.type === "over-caps").length,
    color: "bg-yellow-500"
  },
  {
    type: "returned-payments",
    label: "Returned Payments",
    icon: <CreditCard className="w-4 h-4" />,
    count: mockIssues.filter(i => i.type === "returned-payments").length,
    color: "bg-purple-500"
  },
  {
    type: "fx-missing",
    label: "FX Source Missing",
    icon: <Globe className="w-4 h-4" />,
    count: mockIssues.filter(i => i.type === "fx-missing").length,
    color: "bg-blue-500"
  }
];

export function ValidationCentreWorkspace() {
  const [selectedBucket, setSelectedBucket] = useState<string>("missing-data");
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue | null>(null);
  const [deferReason, setDeferReason] = useState("");
  const [quickFixValue, setQuickFixValue] = useState("");

  const filteredIssues = mockIssues.filter(issue => issue.type === selectedBucket);
  const totalIssues = mockIssues.length;
  const highPriorityIssues = mockIssues.filter(i => i.severity === "high").length;

  const handleResolveIssue = (issueId: string) => {
    console.log("Resolving issue:", issueId);
    // Implementation would remove issue from list
  };

  const handleDeferIssue = (issueId: string, reason: string) => {
    console.log("Deferring issue:", issueId, "Reason:", reason);
    setDeferReason("");
  };

  const handleBulkResolve = () => {
    const bulkResolvableIssues = filteredIssues.filter(issue => issue.canBulkResolve);
    console.log("Bulk resolving issues:", bulkResolvableIssues.map(i => i.id));
  };

  const handleJumpToCrewCard = (crewId: string) => {
    console.log("Jumping to crew card:", crewId);
    // Implementation would navigate to crew payroll card
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      high: { variant: "destructive" as const, label: "High" },
      medium: { variant: "default" as const, label: "Medium" },
      low: { variant: "secondary" as const, label: "Low" }
    };
    const config = variants[severity as keyof typeof variants];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Validation Centre</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
              <span><strong>Period:</strong> January 2025</span>
              <span><strong>Vessel:</strong> MV Atlantic Star</span>
              <span><strong>Status:</strong> Validation Required</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{totalIssues}</div>
              <div className="text-xs text-gray-500">Total Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{highPriorityIssues}</div>
              <div className="text-xs text-gray-500">High Priority</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Bucket List */}
        <div className="w-80 bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Issue Categories</h2>
          </div>
          
          <div className="p-2">
            {validationBuckets.map((bucket) => (
              <button
                key={bucket.type}
                onClick={() => setSelectedBucket(bucket.type)}
                className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                  selectedBucket === bucket.type 
                    ? "bg-blue-50 border border-blue-200" 
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${bucket.color} flex items-center justify-center text-white`}>
                      {bucket.icon}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{bucket.label}</div>
                      <div className="text-xs text-gray-500">
                        {bucket.count} issue{bucket.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {bucket.count}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center - Issue List */}
        <div className="flex-1 bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {validationBuckets.find(b => b.type === selectedBucket)?.label} Issues
            </h2>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
              </span>
              {filteredIssues.some(issue => issue.canBulkResolve) && (
                <Button variant="outline" size="sm" onClick={handleBulkResolve}>
                  Bulk Resolve
                </Button>
              )}
            </div>
          </div>
          
          <div className="overflow-auto h-full">
            {filteredIssues.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium">No issues found</p>
                  <p className="text-sm">All items in this category have been resolved</p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedIssue?.id === issue.id 
                        ? "bg-blue-50 border-blue-300" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          <span className="font-medium text-sm">{issue.element}</span>
                          {getSeverityBadge(issue.severity)}
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          {issue.description}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {issue.crewName} ({issue.crewId})
                          </span>
                          <span>Run: {issue.runId}</span>
                          {issue.amount && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {issue.currency} {issue.amount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-4">
                        {issue.canBulkResolve && (
                          <Badge variant="outline" className="text-xs">
                            Bulk
                          </Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right - Quick Fix Panel */}
        <div className="w-96 bg-white">
          {selectedIssue ? (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Quick Fix Panel</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedIssue.crewName} - {selectedIssue.element}
                </p>
              </div>
              
              <div className="flex-1 p-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Issue Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Issue ID:</span>
                      <span className="font-mono">{selectedIssue.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Severity:</span>
                      {getSeverityBadge(selectedIssue.severity)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Element:</span>
                      <span>{selectedIssue.element}</span>
                    </div>
                    {selectedIssue.amount && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-mono">
                          {selectedIssue.currency} {selectedIssue.amount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Fix Options */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quick Fix</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedIssue.type === "missing-data" && (
                      <div>
                        <Label className="text-xs">Enter missing value</Label>
                        <Input 
                          placeholder="e.g., IBAN, Account Number"
                          value={quickFixValue}
                          onChange={(e) => setQuickFixValue(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                    
                    {selectedIssue.type === "rate-not-found" && (
                      <div>
                        <Label className="text-xs">Set overtime rate (per hour)</Label>
                        <Input 
                          type="number"
                          placeholder="75.50"
                          value={quickFixValue}
                          onChange={(e) => setQuickFixValue(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                    
                    {selectedIssue.type === "over-caps" && (
                      <div>
                        <Label className="text-xs">Adjust hours or approve override</Label>
                        <Input 
                          type="number"
                          placeholder="80"
                          value={quickFixValue}
                          onChange={(e) => setQuickFixValue(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                    
                    {selectedIssue.type === "fx-missing" && (
                      <div>
                        <Label className="text-xs">Exchange rate (EUR/USD)</Label>
                        <Input 
                          type="number"
                          step="0.0001"
                          placeholder="1.0934"
                          value={quickFixValue}
                          onChange={(e) => setQuickFixValue(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <Button 
                      className="w-full" 
                      onClick={() => handleResolveIssue(selectedIssue.id)}
                      disabled={!quickFixValue && selectedIssue.type !== "negative-net"}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Resolve Issue
                    </Button>
                  </CardContent>
                </Card>

                {/* Defer Option */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Defer Issue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Reason for deferral</Label>
                      <textarea 
                        placeholder="Explain why this issue should be deferred..."
                        value={deferReason}
                        onChange={(e) => setDeferReason(e.target.value)}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                        rows={3}
                      />
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleDeferIssue(selectedIssue.id, deferReason)}
                      disabled={!deferReason}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Defer Issue
                    </Button>
                  </CardContent>
                </Card>

                {/* Navigation */}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleJumpToCrewCard(selectedIssue.crewId)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Jump to Crew Card
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">No issue selected</p>
                <p className="text-sm">Select an issue from the list to view details and quick fix options</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}