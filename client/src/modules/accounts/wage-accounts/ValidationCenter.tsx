/**
 * Validation Center - Issue management and resolution center
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  CheckCircle,
  Clock,
  DollarSign,
  FileX,
  CreditCard,
  TrendingUp,
  Search,
  Filter,
  ChevronRight
} from "lucide-react";

interface ValidationCenterProps {
  payRunId: string | null;
  onNavigate: (view: string, payRunId?: string, crewId?: string) => void;
}

interface ValidationIssue {
  id: string;
  bucket: string;
  crew: string;
  element: string;
  description: string;
  severity: "error" | "warning" | "info";
  status: "open" | "deferred" | "resolved";
}

export function ValidationCenter({ payRunId, onNavigate }: ValidationCenterProps) {
  const [selectedBucket, setSelectedBucket] = useState<string>("missing-data");
  const [searchTerm, setSearchTerm] = useState("");

  // Mock validation buckets
  const validationBuckets = [
    {
      id: "missing-data",
      name: "Missing Data",
      count: 5,
      severity: "error",
      icon: FileX,
      color: "text-red-600 bg-red-50"
    },
    {
      id: "rate-not-found",
      name: "Rate Not Found",
      count: 3,
      severity: "error",
      icon: DollarSign,
      color: "text-orange-600 bg-orange-50"
    },
    {
      id: "negative-net",
      name: "Negative Net Pay",
      count: 1,
      severity: "error",
      icon: TrendingUp,
      color: "text-red-600 bg-red-50"
    },
    {
      id: "over-caps",
      name: "Over Caps",
      count: 2,
      severity: "warning",
      icon: AlertTriangle,
      color: "text-yellow-600 bg-yellow-50"
    },
    {
      id: "returned-payments",
      name: "Returned Payments",
      count: 1,
      severity: "error",
      icon: CreditCard,
      color: "text-purple-600 bg-purple-50"
    },
    {
      id: "fx-missing",
      name: "FX Rate Missing",
      count: 0,
      severity: "info",
      icon: Clock,
      color: "text-blue-600 bg-blue-50"
    }
  ];

  // Mock issues for selected bucket
  const mockIssues: ValidationIssue[] = [
    {
      id: "1",
      bucket: "missing-data",
      crew: "John Smith",
      element: "Time Entries",
      description: "Missing time entries for 3 days (Jan 5-7)",
      severity: "error",
      status: "open"
    },
    {
      id: "2",
      bucket: "missing-data",
      crew: "Mary Johnson",
      element: "Contract",
      description: "Contract end date not specified",
      severity: "error",
      status: "open"
    },
    {
      id: "3",
      bucket: "missing-data",
      crew: "Robert Chen",
      element: "Bank Details",
      description: "IBAN not verified for allotment recipient",
      severity: "warning",
      status: "open"
    },
    {
      id: "4",
      bucket: "rate-not-found",
      crew: "Sarah Wilson",
      element: "Overtime",
      description: "OT rate not defined for rank",
      severity: "error",
      status: "open"
    },
    {
      id: "5",
      bucket: "over-caps",
      crew: "Mike Brown",
      element: "Cash Advance",
      description: "Advance exceeds 50% of net pay",
      severity: "warning",
      status: "deferred"
    }
  ];

  const filteredIssues = mockIssues.filter(issue => 
    issue.bucket === selectedBucket &&
    (issue.crew.toLowerCase().includes(searchTerm.toLowerCase()) ||
     issue.element.toLowerCase().includes(searchTerm.toLowerCase()) ||
     issue.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error": return <XCircle className="h-4 w-4 text-red-600" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "info": return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default: return null;
    }
  };

  const totalIssues = validationBuckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">January 2025</Badge>
                <Badge>MV Atlantic Explorer</Badge>
                {totalIssues > 0 && (
                  <Badge variant="destructive">
                    {totalIssues} Issues
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              Bulk Resolve
            </Button>
            <Button>
              Run Validation
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Buckets List */}
        <div className="w-[300px] bg-gray-50 border-r p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Validation Buckets</h3>
          </div>
          <div className="space-y-2">
            {validationBuckets.map((bucket) => {
              const Icon = bucket.icon;
              return (
                <Card
                  key={bucket.id}
                  className={`cursor-pointer transition-all ${
                    selectedBucket === bucket.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedBucket(bucket.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${bucket.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{bucket.name}</div>
                          <div className="text-xs text-gray-500">
                            {bucket.count} {bucket.count === 1 ? 'issue' : 'issues'}
                          </div>
                        </div>
                      </div>
                      {bucket.count > 0 && (
                        <Badge 
                          variant={bucket.severity === "error" ? "destructive" : 
                                  bucket.severity === "warning" ? "outline" : "secondary"}
                          className="text-xs"
                        >
                          {bucket.count}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Issues List */}
        <div className="flex-1 p-4">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {validationBuckets.find(b => b.id === selectedBucket)?.name} Issues
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search issues..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-[250px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="space-y-2">
                {filteredIssues.length > 0 ? (
                  filteredIssues.map((issue) => (
                    <Card key={issue.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {getSeverityIcon(issue.severity)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{issue.crew}</span>
                                <Badge variant="outline" className="text-xs">
                                  {issue.element}
                                </Badge>
                                {issue.status === "deferred" && (
                                  <Badge variant="secondary" className="text-xs">
                                    Deferred
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{issue.description}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => onNavigate('crew-card', payRunId || undefined, issue.crew)}
                            >
                              View
                            </Button>
                            <Button variant="ghost" size="sm">
                              Fix
                            </Button>
                            <Button variant="ghost" size="sm">
                              Defer
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600">No issues found in this category</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Fix Panel */}
        <div className="w-[350px] border-l bg-gray-50 p-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Quick Fix</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredIssues.length > 0 && filteredIssues[0] ? (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-900 mb-1">
                      Selected Issue
                    </div>
                    <div className="text-sm text-blue-700">
                      {filteredIssues[0].crew} - {filteredIssues[0].description}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Resolution</label>
                      <select className="mt-1 w-full p-2 border rounded-md">
                        <option>Select resolution...</option>
                        <option>Apply default value</option>
                        <option>Use previous month</option>
                        <option>Manual override</option>
                        <option>Defer to next run</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Notes</label>
                      <textarea 
                        className="mt-1 w-full p-2 border rounded-md"
                        rows={3}
                        placeholder="Add resolution notes..."
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1">Apply Fix</Button>
                      <Button variant="outline" className="flex-1">Skip</Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm text-gray-600 mb-2">Suggested Actions:</div>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Import missing time entries
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Update crew contract
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Verify bank details
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select an issue to view quick fix options
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {totalIssues} total issues across all categories
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Resolve Selected</Button>
            <Button variant="outline">Defer All</Button>
            <Button>Bulk Resolve</Button>
          </div>
        </div>
      </div>
    </div>
  );
}