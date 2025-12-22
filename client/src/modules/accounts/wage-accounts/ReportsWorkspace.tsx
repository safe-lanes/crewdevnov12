/**
 * Reports Workspace
 * Purpose: Comprehensive reporting hub with saved filters and column builder
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  BarChart3,
  Calendar,
  Clock,
  Download,
  Eye,
  Filter,
  Play,
  Plus,
  Save,
  Settings,
  Ship,
  TrendingUp,
  Users,
  DollarSign,
  FileText,
  Target,
  Building2,
  CreditCard,
  PieChart,
  LineChart,
  Edit,
  Copy,
  Trash2,
  Mail,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

interface SavedReport {
  id: string;
  name: string;
  description: string;
  type: string;
  filtersApplied: string[];
  lastRunDate: string;
  schedule?: string;
  createdBy: string;
  columns: string[];
  customFields: string[];
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  defaultColumns: string[];
  availableFilters: string[];
  chartType?: string;
}

// Mock data for saved reports
const mockSavedReports: SavedReport[] = [
  {
    id: "RPT001",
    name: "Monthly Payroll Summary",
    description: "Complete payroll breakdown by vessel and rank",
    type: "Payroll Summary",
    filtersApplied: ["Vessel: MV Atlantic Star", "Period: Jan 2025", "Rank: All"],
    lastRunDate: "2025-01-15",
    schedule: "Monthly",
    createdBy: "John Smith",
    columns: ["Crew Name", "Rank", "Basic Wage", "Overtime", "Net Pay"],
    customFields: ["Vessel Name", "Cost Center"]
  },
  {
    id: "RPT002",
    name: "Overtime Analytics Q1",
    description: "Overtime hours and costs analysis",
    type: "Overtime Analytics",
    filtersApplied: ["Period: Q1 2025", "Department: Deck"],
    lastRunDate: "2025-01-14",
    createdBy: "Sarah Chen",
    columns: ["Crew Name", "OT Hours", "OT Rate", "Total OT Pay"],
    customFields: ["Project Code"]
  },
  {
    id: "RPT003",
    name: "Allotment Register",
    description: "Beneficiary payments tracking",
    type: "Allotment Register",
    filtersApplied: ["Status: Active", "Currency: USD"],
    lastRunDate: "2025-01-13",
    schedule: "Weekly",
    createdBy: "Mike Rodriguez",
    columns: ["Crew Name", "Beneficiary", "Amount", "Bank Details"],
    customFields: ["KYC Status"]
  }
];

// Report templates
const reportTemplates: ReportTemplate[] = [
  {
    id: "payroll_summary",
    name: "Payroll Summary",
    description: "Complete payroll breakdown by period",
    category: "Payroll",
    icon: DollarSign,
    defaultColumns: ["Crew Name", "Rank", "Basic Wage", "Overtime", "Deductions", "Net Pay"],
    availableFilters: ["Period", "Vessel", "Rank", "Department"],
    chartType: "bar"
  },
  {
    id: "earnings_deductions",
    name: "Earnings/Deductions Analysis",
    description: "Detailed breakdown of all pay elements",
    category: "Analytics",
    icon: BarChart3,
    defaultColumns: ["Pay Element", "Type", "Amount", "Percentage"],
    availableFilters: ["Pay Element Type", "Period", "Crew"],
    chartType: "pie"
  },
  {
    id: "overtime_analytics",
    name: "Overtime Analytics",
    description: "Overtime hours, rates and cost analysis",
    category: "Analytics",
    icon: Clock,
    defaultColumns: ["Crew Name", "Regular Hours", "OT Hours", "OT Rate", "Total OT Cost"],
    availableFilters: ["Period", "Rank", "OT Type"],
    chartType: "line"
  },
  {
    id: "leave_liability",
    name: "Leave Liability",
    description: "Accrued leave balances and liability calculation",
    category: "Compliance",
    icon: Calendar,
    defaultColumns: ["Crew Name", "Accrued Days", "Leave Rate", "Liability Amount"],
    availableFilters: ["Leave Type", "Accrual Date", "Vessel"]
  },
  {
    id: "fx_gain_loss",
    name: "FX Gain/Loss",
    description: "Foreign exchange impact on payroll",
    category: "Financial",
    icon: TrendingUp,
    defaultColumns: ["Currency Pair", "Exchange Rate", "Amount", "Gain/Loss"],
    availableFilters: ["Currency", "Period", "Rate Source"],
    chartType: "line"
  },
  {
    id: "allotment_register",
    name: "Allotment Register",
    description: "Beneficiary payments and status tracking",
    category: "Payments",
    icon: Users,
    defaultColumns: ["Crew Name", "Beneficiary", "Amount", "Bank", "Status"],
    availableFilters: ["Payment Status", "Currency", "Country"]
  },
  {
    id: "returned_payments",
    name: "Returned Payments",
    description: "Failed and returned payment tracking",
    category: "Payments",
    icon: AlertTriangle,
    defaultColumns: ["Payment ID", "Crew Name", "Amount", "Return Reason", "Status"],
    availableFilters: ["Return Reason", "Payment Type", "Period"]
  },
  {
    id: "cash_advance_ledger",
    name: "Cash Advance Ledger",
    description: "Cash advances issued and recovered",
    category: "Cash Management",
    icon: CreditCard,
    defaultColumns: ["Crew Name", "Advance Amount", "Recovery Amount", "Balance"],
    availableFilters: ["Advance Type", "Status", "Vessel"]
  },
  {
    id: "bond_sales_deductions",
    name: "Bond Sales vs Deductions",
    description: "Bond sales reconciliation with deductions",
    category: "Cash Management",
    icon: Building2,
    defaultColumns: ["Crew Name", "Bond Sale", "Deduction Amount", "Variance"],
    availableFilters: ["Bond Type", "Reconciliation Status", "Period"]
  },
  {
    id: "headcount_cost",
    name: "Headcount Cost by Rank/Flag/CBA",
    description: "Crew costs breakdown by classification",
    category: "Analytics",
    icon: PieChart,
    defaultColumns: ["Classification", "Headcount", "Total Cost", "Average Cost"],
    availableFilters: ["Rank", "Flag", "CBA", "Vessel Type"],
    chartType: "pie"
  }
];

const availableColumns = [
  "Crew Name", "Rank", "Department", "Vessel", "Basic Wage", "Overtime", "Allowances",
  "Deductions", "Net Pay", "Currency", "Exchange Rate", "Period", "Status", "Bank Details",
  "Beneficiary", "Amount", "Payment Date", "Return Reason", "Advance Type", "Bond Type",
  "Classification", "Headcount", "Total Cost", "Average Cost", "FX Gain/Loss"
];

const customFieldOptions = [
  "Vessel Name", "Cost Center", "Project Code", "Voyage Number", "KYC Status",
  "License Expiry", "Emergency Contact", "Port of Registry", "Budget Line"
];

export function ReportsWorkspace() {
  const [isNewReportOpen, setIsNewReportOpen] = useState(false);
  const [isColumnBuilderOpen, setIsColumnBuilderOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [reportBuilder, setReportBuilder] = useState({
    name: "",
    description: "",
    selectedColumns: [] as string[],
    selectedCustomFields: [] as string[],
    filters: {} as Record<string, string>,
    groupBy: "",
    sortBy: ""
  });

  const handleCreateNewReport = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setReportBuilder({
      name: `New ${template.name}`,
      description: template.description,
      selectedColumns: template.defaultColumns,
      selectedCustomFields: [],
      filters: {},
      groupBy: "",
      sortBy: ""
    });
    setIsNewReportOpen(true);
  };

  const handleSaveReport = () => {
    console.log("Saving report:", reportBuilder);
    setIsNewReportOpen(false);
  };

  const handleRunReport = (report?: SavedReport) => {
    console.log("Running report:", report || reportBuilder);
  };

  const handleScheduleExport = (report: SavedReport) => {
    setSelectedReport(report);
    setIsScheduleDialogOpen(true);
  };

  const handleColumnToggle = (column: string, checked: boolean) => {
    if (checked) {
      setReportBuilder(prev => ({
        ...prev,
        selectedColumns: [...prev.selectedColumns, column]
      }));
    } else {
      setReportBuilder(prev => ({
        ...prev,
        selectedColumns: prev.selectedColumns.filter(col => col !== column)
      }));
    }
  };

  const handleCustomFieldToggle = (field: string, checked: boolean) => {
    if (checked) {
      setReportBuilder(prev => ({
        ...prev,
        selectedCustomFields: [...prev.selectedCustomFields, field]
      }));
    } else {
      setReportBuilder(prev => ({
        ...prev,
        selectedCustomFields: prev.selectedCustomFields.filter(f => f !== field)
      }));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: "default" as const, label: "Active", icon: CheckCircle },
      scheduled: { variant: "secondary" as const, label: "Scheduled", icon: Clock },
      draft: { variant: "outline" as const, label: "Draft", icon: Edit }
    };
    const config = variants[status as keyof typeof variants] || variants.draft;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      "Payroll": "bg-blue-100 text-blue-800",
      "Analytics": "bg-purple-100 text-purple-800",
      "Compliance": "bg-green-100 text-green-800",
      "Financial": "bg-orange-100 text-orange-800",
      "Payments": "bg-red-100 text-red-800",
      "Cash Management": "bg-yellow-100 text-yellow-800"
    };
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* Left - Title and Context */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports Hub</h1>
            <div className="flex items-center gap-6 text-sm text-gray-600 mt-1">
              <div className="flex items-center gap-1">
                <Ship className="w-4 h-4" />
                <span><strong>Client:</strong> Maritime Corp</span>
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vessels</SelectItem>
                  <SelectItem value="atlantic">MV Atlantic Star</SelectItem>
                  <SelectItem value="pacific">MV Pacific Dawn</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="current">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="last">Last Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <Sheet open={isColumnBuilderOpen} onOpenChange={setIsColumnBuilderOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-1">
                  <Settings className="w-4 h-4" />
                  Column Builder
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[500px] sm:max-w-[500px]">
                <SheetHeader>
                  <SheetTitle>Column Builder</SheetTitle>
                  <SheetDescription>
                    Customize columns for your reports including custom fields
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Standard Columns</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {availableColumns.map((column) => (
                        <div key={column} className="flex items-center space-x-2">
                          <Checkbox
                            id={column}
                            checked={reportBuilder.selectedColumns.includes(column)}
                            onCheckedChange={(checked) => handleColumnToggle(column, checked as boolean)}
                          />
                          <Label htmlFor={column} className="text-sm">{column}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Custom Fields</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {customFieldOptions.map((field) => (
                        <div key={field} className="flex items-center space-x-2">
                          <Checkbox
                            id={field}
                            checked={reportBuilder.selectedCustomFields.includes(field)}
                            onCheckedChange={(checked) => handleCustomFieldToggle(field, checked as boolean)}
                          />
                          <Label htmlFor={field} className="text-sm">{field}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm text-gray-600 mb-2">
                      Selected: {reportBuilder.selectedColumns.length + reportBuilder.selectedCustomFields.length} columns
                    </div>
                    <Button onClick={() => setIsColumnBuilderOpen(false)} className="w-full">
                      Apply Columns
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="outline" className="gap-1">
              <Download className="w-4 h-4" />
              Schedule Export
            </Button>

            <Button className="gap-1">
              <Plus className="w-4 h-4" />
              Create New Report
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Saved Reports List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span>Saved Reports</span>
              </div>
              <Badge variant="outline">{mockSavedReports.length} saved</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-4 p-3 bg-gray-100 rounded-lg font-medium text-sm">
                <div>Name</div>
                <div>Description</div>
                <div>Type</div>
                <div>Filters Applied</div>
                <div>Last Run</div>
                <div className="text-center">Schedule</div>
                <div className="text-center">Actions</div>
              </div>
              
              {mockSavedReports.map((report) => (
                <div key={report.id} className="grid grid-cols-7 gap-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div>
                    <div className="font-medium">{report.name}</div>
                    <div className="text-xs text-gray-500">by {report.createdBy}</div>
                  </div>
                  
                  <div className="text-sm">{report.description}</div>
                  
                  <div>
                    <Badge variant="outline" className={getCategoryColor("Payroll")}>
                      {report.type}
                    </Badge>
                  </div>
                  
                  <div className="text-sm">
                    {report.filtersApplied.slice(0, 2).map((filter, index) => (
                      <div key={index} className="truncate">{filter}</div>
                    ))}
                    {report.filtersApplied.length > 2 && (
                      <div className="text-xs text-gray-500">+{report.filtersApplied.length - 2} more</div>
                    )}
                  </div>
                  
                  <div className="text-sm">{report.lastRunDate}</div>
                  
                  <div className="text-center">
                    {report.schedule ? (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" />
                        {report.schedule}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">Manual</span>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" variant="outline" onClick={() => handleRunReport(report)} title="Run Report">
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" title="Edit Report">
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleScheduleExport(report)} title="Schedule Export">
                        <Mail className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Report Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              <span>Report Templates</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {reportTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-blue-600" />
                          <div>
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            <Badge variant="outline" className={getCategoryColor(template.category)}>
                              {template.category}
                            </Badge>
                          </div>
                        </div>
                        {template.chartType && (
                          <Badge variant="secondary" className="text-xs">
                            {template.chartType}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                      
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs font-medium text-gray-700">Default Columns</div>
                          <div className="text-xs text-gray-600">
                            {template.defaultColumns.slice(0, 3).join(', ')}
                            {template.defaultColumns.length > 3 && ` +${template.defaultColumns.length - 3}`}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs font-medium text-gray-700">Available Filters</div>
                          <div className="text-xs text-gray-600">
                            {template.availableFilters.join(', ')}
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        size="sm" 
                        className="w-full mt-3" 
                        onClick={() => handleCreateNewReport(template)}
                      >
                        Create Report
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Report Dialog */}
      <Dialog open={isNewReportOpen} onOpenChange={setIsNewReportOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Report</DialogTitle>
            <DialogDescription>
              Configure your report with custom fields, filters, and output options
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Report Name</Label>
                  <Input 
                    value={reportBuilder.name}
                    onChange={(e) => setReportBuilder({...reportBuilder, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input 
                    value={reportBuilder.description}
                    onChange={(e) => setReportBuilder({...reportBuilder, description: e.target.value})}
                  />
                </div>
              </div>

              {/* Filters Panel */}
              <div>
                <h4 className="font-medium mb-3">Filters</h4>
                <div className="grid grid-cols-3 gap-4">
                  {selectedTemplate.availableFilters.map((filter) => (
                    <div key={filter}>
                      <Label className="text-xs">{filter}</Label>
                      <Select onValueChange={(value) => 
                        setReportBuilder(prev => ({
                          ...prev,
                          filters: {...prev.filters, [filter]: value}
                        }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${filter}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="option1">Option 1</SelectItem>
                          <SelectItem value="option2">Option 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grouping & Sorting */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Group By</Label>
                  <Select onValueChange={(value) => setReportBuilder({...reportBuilder, groupBy: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vessel">Vessel</SelectItem>
                      <SelectItem value="rank">Rank</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sort By</Label>
                  <Select onValueChange={(value) => setReportBuilder({...reportBuilder, sortBy: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview Section */}
              <div>
                <h4 className="font-medium mb-3">Preview</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-2">
                    Selected Columns: {reportBuilder.selectedColumns.length + reportBuilder.selectedCustomFields.length}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...reportBuilder.selectedColumns, ...reportBuilder.selectedCustomFields].map((column) => (
                      <Badge key={column} variant="outline" className="text-xs">
                        {column}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSaveReport} className="flex-1">
                  <Save className="w-4 h-4 mr-1" />
                  Save Report
                </Button>
                <Button variant="outline" onClick={() => handleRunReport()}>
                  <Play className="w-4 h-4 mr-1" />
                  Run Now
                </Button>
                <Button variant="outline" onClick={() => setIsNewReportOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Export Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Export</DialogTitle>
            <DialogDescription>
              Set up automated export schedule for this report
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Report: {selectedReport.name}</Label>
              </div>
              
              <div>
                <Label>Frequency</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Export Format</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Email Recipients</Label>
                <Textarea placeholder="Enter email addresses separated by commas" />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox id="auto-email" />
                <Label htmlFor="auto-email">Send email notification on completion</Label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setIsScheduleDialogOpen(false)} className="flex-1">
                  Schedule Export
                </Button>
                <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}