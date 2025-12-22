/**
 * Pay Run Board - Main dashboard for managing pay runs
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar,
  Filter,
  Plus,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  FileText
} from "lucide-react";
import { format } from "date-fns";

interface PayRun {
  id: string;
  vessel: string;
  period: {
    start: Date;
    end: Date;
  };
  crewCount: number;
  netTotal: number;
  currency: string;
  status: "draft" | "calculating" | "validated" | "approved" | "paid" | "posted";
  warnings: number;
  offCycle: boolean;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

// Mock data for demonstration
const mockPayRuns: PayRun[] = [
  {
    id: "PR001",
    vessel: "MV Atlantic Explorer",
    period: {
      start: new Date("2025-01-01"),
      end: new Date("2025-01-31")
    },
    crewCount: 24,
    netTotal: 125000,
    currency: "USD",
    status: "validated",
    warnings: 2,
    offCycle: false,
    createdBy: "John Smith",
    createdAt: new Date("2025-01-05"),
    lastModified: new Date("2025-01-12")
  },
  {
    id: "PR002",
    vessel: "MV Pacific Voyager",
    period: {
      start: new Date("2025-01-01"),
      end: new Date("2025-01-31")
    },
    crewCount: 18,
    netTotal: 95000,
    currency: "USD",
    status: "draft",
    warnings: 5,
    offCycle: false,
    createdBy: "Mary Johnson",
    createdAt: new Date("2025-01-08"),
    lastModified: new Date("2025-01-11")
  },
  {
    id: "PR003",
    vessel: "MV Global Carrier",
    period: {
      start: new Date("2025-01-15"),
      end: new Date("2025-01-15")
    },
    crewCount: 3,
    netTotal: 8500,
    currency: "USD",
    status: "approved",
    warnings: 0,
    offCycle: true,
    createdBy: "John Smith",
    createdAt: new Date("2025-01-10"),
    lastModified: new Date("2025-01-10")
  }
];

export function PayRunBoard() {
  const [selectedVessel, setSelectedVessel] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showOffCycle, setShowOffCycle] = useState(false);
  const [payRuns] = useState<PayRun[]>(mockPayRuns);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500";
      case "calculating": return "bg-blue-500";
      case "validated": return "bg-yellow-500";
      case "approved": return "bg-green-500";
      case "paid": return "bg-purple-500";
      case "posted": return "bg-indigo-500";
      default: return "bg-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft": return <FileText className="h-4 w-4" />;
      case "calculating": return <Clock className="h-4 w-4" />;
      case "validated": return <AlertCircle className="h-4 w-4" />;
      case "approved": return <CheckCircle className="h-4 w-4" />;
      case "paid": return <DollarSign className="h-4 w-4" />;
      case "posted": return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const filteredPayRuns = payRuns.filter(run => {
    if (selectedVessel !== "all" && run.vessel !== selectedVessel) return false;
    if (selectedStatus !== "all" && run.status !== selectedStatus) return false;
    if (!showOffCycle && run.offCycle) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pay Run Board</h2>
          <p className="text-gray-600">Manage and monitor all payroll runs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="bg-[#52baf3] hover:bg-[#45a0d8]">
            <Plus className="h-4 w-4 mr-2" />
            New Pay Run
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Filters</CardTitle>
            <Filter className="h-4 w-4 text-gray-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Select value={selectedVessel} onValueChange={setSelectedVessel}>
              <SelectTrigger>
                <SelectValue placeholder="Select Vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                <SelectItem value="MV Atlantic Explorer">MV Atlantic Explorer</SelectItem>
                <SelectItem value="MV Pacific Voyager">MV Pacific Voyager</SelectItem>
                <SelectItem value="MV Global Carrier">MV Global Carrier</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                <SelectItem value="previous">Previous Month</SelectItem>
                <SelectItem value="quarter">Current Quarter</SelectItem>
                <SelectItem value="year">Current Year</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="calculating">Calculating</SelectItem>
                <SelectItem value="validated">Validated</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="offCycle"
                checked={showOffCycle}
                onChange={(e) => setShowOffCycle(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="offCycle" className="text-sm text-gray-700">
                Show Off-cycle
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pay Run Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPayRuns.map((run) => (
          <Card 
            key={run.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer border-l-4"
            style={{ borderLeftColor: getStatusColor(run.status).replace("bg-", "#").replace("500", "") }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{run.vessel}</CardTitle>
                {run.offCycle && (
                  <Badge variant="outline" className="text-xs">
                    Off-cycle
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-600">
                  {format(run.period.start, "MMM dd")} - {format(run.period.end, "MMM dd, yyyy")}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge className={`${getStatusColor(run.status)} text-white`}>
                    {getStatusIcon(run.status)}
                    <span className="ml-1 capitalize">{run.status}</span>
                  </Badge>
                  {run.warnings > 0 && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {run.warnings} warnings
                    </Badge>
                  )}
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium">{run.crewCount}</div>
                      <div className="text-xs text-gray-500">Crew</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium">
                        {run.currency} {run.netTotal.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">Net Total</div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>by {run.createdBy}</span>
                    <span>{format(run.lastModified, "MMM dd, HH:mm")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Changes Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Changes Affecting Payroll</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium">Contract updated for John Doe</div>
                  <div className="text-xs text-gray-500">MV Atlantic Explorer - 2 hours ago</div>
                </div>
              </div>
              <Button variant="ghost" size="sm">View</Button>
            </div>
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium">New CBA rates applied</div>
                  <div className="text-xs text-gray-500">All vessels - 5 hours ago</div>
                </div>
              </div>
              <Button variant="ghost" size="sm">View</Button>
            </div>
            <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium">FX rates updated</div>
                  <div className="text-xs text-gray-500">System-wide - 1 day ago</div>
                </div>
              </div>
              <Button variant="ghost" size="sm">View</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}