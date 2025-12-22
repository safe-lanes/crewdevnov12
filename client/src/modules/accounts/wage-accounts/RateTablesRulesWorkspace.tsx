/**
 * Rate Tables & Rules Workspace
 * Purpose: No-code rule library for payroll calculations
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PayElement as ApiPayElement } from '@shared/schema';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { PayElementModal } from "@/components/contract-data/PayElementModal";
import { AgGridTable } from "@/components/AgGridTable";
import type { ColDef, ICellRendererParams } from 'ag-grid-community';

import { 
  Calculator,
  Copy,
  Download,
  Upload,
  TestTube,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Ship,
  DollarSign,
  Settings,
  FileText,
  User,
  Target,
  Clock,
  TrendingUp,
  Filter,
  CheckCircle,
  AlertTriangle,
  Hash
} from "lucide-react";

// Use shared PayElement type from schema
type PayElement = ApiPayElement;

interface CBATable {
  id: string;
  name: string;
  type: "basic_wages" | "overtime_rates" | "allowances";
  rank: string;
  yearsAtSea: string;
  currency: string;
  rates: Record<string, number>;
  effectiveDate: string;
  expiryDate?: string;
  version: number;
  status: "active" | "inactive" | "expired";
}

interface Rule {
  id: string;
  name: string;
  type: "calculation" | "proration" | "overtime" | "leave";
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  effectiveDate: string;
  status: "active" | "inactive";
}

interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  type: string;
  element: string;
  operation: string;
  value: string;
}

interface Template {
  id: string;
  name: string;
  type: "payrun" | "payslip" | "portage_bill";
  format: "PDF" | "Excel" | "Word";
  fields: string[];
  customFields: string[];
  lastModified: string;
}

// Real API data will be fetched using useQuery

const mockCBATables: CBATable[] = [
  {
    id: "CBA001",
    name: "Officers Basic Wages 2025",
    type: "basic_wages",
    rank: "Officer",
    yearsAtSea: "0-5",
    currency: "USD",
    rates: {
      "Captain": 8000,
      "Chief Officer": 6000,
      "Second Officer": 4500,
      "Third Officer": 3500
    },
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
    version: 1,
    status: "active"
  },
  {
    id: "CBA002",
    name: "Ratings Basic Wages 2025",
    type: "basic_wages", 
    rank: "Rating",
    yearsAtSea: "All",
    currency: "USD",
    rates: {
      "Bosun": 2800,
      "AB Seaman": 2200,
      "OS": 1800,
      "Cook": 2500
    },
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
    version: 1,
    status: "active"
  }
];

const mockRules: Rule[] = [
  {
    id: "RULE001",
    name: "Weekend Overtime Multiplier",
    type: "overtime",
    conditions: [
      { field: "DAY_OF_WEEK", operator: "IN", value: "SAT,SUN" },
      { field: "WORK_HOURS", operator: ">", value: "8" }
    ],
    actions: [
      { type: "MULTIPLY", element: "OT_RATE", operation: "*", value: "2.0" }
    ],
    priority: 1,
    effectiveDate: "2025-01-01",
    status: "active"
  },
  {
    id: "RULE002",
    name: "Proration for Mid-Month Joining",
    type: "proration",
    conditions: [
      { field: "JOIN_DATE", operator: ">", value: "15" }
    ],
    actions: [
      { type: "PRORATE", element: "BASIC_WAGE", operation: "/", value: "30 * DAYS_WORKED" }
    ],
    priority: 2,
    effectiveDate: "2025-01-01",
    status: "active"
  }
];

const mockTemplates: Template[] = [
  {
    id: "TPL001",
    name: "Standard Payslip",
    type: "payslip",
    format: "PDF",
    fields: ["CREW_NAME", "RANK", "BASIC_WAGE", "OVERTIME", "DEDUCTIONS", "NET_PAY"],
    customFields: ["VESSEL_NAME", "PAYROLL_PERIOD"],
    lastModified: "2025-01-10"
  },
  {
    id: "TPL002",
    name: "Monthly Payrun Report",
    type: "payrun",
    format: "Excel",
    fields: ["ALL_CREW", "SUMMARY_TOTALS", "BREAKDOWN_BY_RANK"],
    customFields: ["COST_CENTER", "VOYAGE_NUMBER"],
    lastModified: "2025-01-08"
  }
];

export function RateTablesRulesWorkspace() {
  const [activeTab, setActiveTab] = useState("pay-elements");
  const [isNewElementOpen, setIsNewElementOpen] = useState(false);
  const [isEditElementOpen, setIsEditElementOpen] = useState(false);
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [isTestRuleOpen, setIsTestRuleOpen] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editingElement, setEditingElement] = useState<any>(null);

  const [newElementData, setNewElementData] = useState({
    name: "",
    code: "",
    type: "earning",
    category: "",
    formula: "",
    rounding: "ROUND_NEAREST_CENT"
  });

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedEffectiveDate, setSelectedEffectiveDate] = useState(new Date('2025-01-01'));

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pay elements from API
  const { data: payElements = [], isLoading: isLoadingPayElements, error: payElementsError, refetch } = useQuery<PayElement[]>({
    queryKey: ['/api/pay-elements'],
    queryFn: async () => {
      console.log('🌐 Fetching pay elements from API...');
      const response = await fetch('/api/pay-elements');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('📥 Fetched pay elements:', data.length, 'items');
      return data;
    },
    staleTime: 0, // Always refetch
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Log query state for debugging
  console.log('🔍 Query State:', { 
    payElementsCount: payElements.length, 
    isLoading: isLoadingPayElements, 
    hasError: !!payElementsError,
    error: payElementsError?.message 
  });

  // Create pay element mutation
  const createPayElementMutation = useMutation({
    mutationFn: async (newElement: any) => {
      console.log('🚀 MUTATION STARTED - About to create pay element:', newElement);
      
      const payload = {
        id: `PE_${Date.now()}`,
        name: newElement.payElementName,
        code: newElement.payElementCode || newElement.payElementName.toUpperCase().replace(/\s+/g, '_'),
        type: newElement.type,
        category: newElement.category || 'Fixed',
        formula: newElement.formula || 'No Formula',
        rounding: newElement.rounding || 'ROUND_NEAREST_CENT',
        ceiling: null,
        floor: null,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        vesselGroups: JSON.stringify(['all-vessels']),
        reflectInContract: newElement.reflectInContract !== false
      };
      
      console.log('📤 API PAYLOAD:', payload);
      
      try {
        const response = await fetch('/api/pay-elements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        console.log('📡 API RESPONSE STATUS:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API ERROR:', errorText);
          throw new Error(`Failed to create pay element: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ API SUCCESS:', result);
        return result;
      } catch (error) {
        console.error('💥 MUTATION ERROR:', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      console.log('🎉 MUTATION SUCCESS:', data);
      
      // Force immediate refetch
      console.log('🔄 Force refetching pay elements...');
      await queryClient.invalidateQueries({ queryKey: ['/api/pay-elements'] });
      await refetch();
      
      toast({
        title: "Success",
        description: "Pay element created successfully",
      });
    },
    onError: (error) => {
      console.error('🔥 MUTATION FAILURE:', error);
      toast({
        title: "Error", 
        description: "Failed to create pay element",
        variant: "destructive",
      });
    },
  });

  // Update pay element mutation
  const updatePayElementMutation = useMutation({
    mutationFn: async (updatedElement: any) => {
      console.log('🔄 UPDATE MUTATION STARTED - About to update pay element:', updatedElement);
      
      const payload = {
        id: updatedElement.payElementId,
        name: updatedElement.payElementName,
        code: updatedElement.payElementCode,
        type: updatedElement.type,
        category: updatedElement.category || 'Fixed',
        formula: updatedElement.formula || 'No Formula',
        rounding: updatedElement.rounding || 'ROUND_NEAREST_CENT',
        ceiling: null,
        floor: null,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        vesselGroups: JSON.stringify(['all-vessels']),
        reflectInContract: updatedElement.reflectInContract !== false
      };
      
      console.log('📤 UPDATE API PAYLOAD:', payload);
      
      try {
        const response = await fetch(`/api/pay-elements/${updatedElement.payElementId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        console.log('📡 UPDATE API RESPONSE STATUS:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ UPDATE API ERROR:', errorText);
          throw new Error(`Failed to update pay element: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ UPDATE API SUCCESS:', result);
        return result;
      } catch (error) {
        console.error('💥 UPDATE MUTATION ERROR:', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      console.log('🎉 UPDATE MUTATION SUCCESS:', data);
      
      // Force immediate refetch
      console.log('🔄 Force refetching pay elements after update...');
      await queryClient.invalidateQueries({ queryKey: ['/api/pay-elements'] });
      await refetch();
      
      toast({
        title: "Success",
        description: "Pay element updated successfully",
      });
    },
    onError: (error) => {
      console.error('💥 UPDATE MUTATION FAILED:', error);
      toast({
        title: "Error",
        description: "Failed to update pay element. Please try again.",
        variant: "destructive",
      });
    }
  });

  const [newRuleData, setNewRuleData] = useState({
    name: "",
    type: "calculation",
    conditions: [{ field: "", operator: "", value: "" }],
    actions: [{ type: "", element: "", operation: "", value: "" }],
    priority: 1
  });

  const handleClone = (item: any) => {
    setSelectedItem(item);
    setIsCloneDialogOpen(true);
  };

  const handleEditElement = (element: PayElement) => {
    // Convert Rate Tables PayElement to PayElementModal format
    const modalElement = {
      payElementId: element.id,
      payElementCode: element.code,
      payElementName: element.name,
      type: element.type as 'earning' | 'deduction',
      category: element.category,
      formula: element.formula,
      rounding: element.rounding,
      value: 0,
      applicable: element.status === 'active',
      reflectInContract: (element as any).reflectInContract !== false
    };
    setEditingElement(modalElement);
    setModalMode('edit');
    setIsNewElementOpen(true);
  };

  const handleCreateElement = () => {
    console.log('Creating new element - opening PayElementModal');
    setEditingElement(null);
    setModalMode('create');
    setIsNewElementOpen(true);
    console.log('Modal state:', { isNewElementOpen: true, modalMode: 'create', editingElement: null });
  };

  const handleSaveElement = (element: any) => {
    console.log('🔧 HANDLE SAVE ELEMENT CALLED - Mode:', modalMode, 'Element:', element);
    
    if (modalMode === 'create') {
      console.log('🚀 CALLING MUTATION with element:', element);
      console.log('🎯 Mutation state - isPending:', createPayElementMutation.isPending, 'isError:', createPayElementMutation.isError);
      createPayElementMutation.mutate(element);
    } else {
      console.log('🔄 CALLING UPDATE MUTATION with element:', element);
      console.log('🎯 Update Mutation state - isPending:', updatePayElementMutation.isPending, 'isError:', updatePayElementMutation.isError);
      updatePayElementMutation.mutate(element);
    }
    setIsNewElementOpen(false);
  };



  const handleExportData = (format: string) => {
    console.log(`Exporting data as ${format}`);
  };

  const handleImportData = () => {
    console.log("Importing data");
  };

  const handleTestRule = () => {
    console.log("Testing rule with sample crew data");
    setIsTestRuleOpen(false);
  };

  const addCondition = () => {
    setNewRuleData({
      ...newRuleData,
      conditions: [...newRuleData.conditions, { field: "", operator: "", value: "" }]
    });
  };

  const addAction = () => {
    setNewRuleData({
      ...newRuleData,
      actions: [...newRuleData.actions, { type: "", element: "", operation: "", value: "" }]
    });
  };

  const updateCondition = (index: number, field: string, value: string) => {
    const updatedConditions = [...newRuleData.conditions];
    updatedConditions[index] = { ...updatedConditions[index], [field]: value };
    setNewRuleData({ ...newRuleData, conditions: updatedConditions });
  };

  const updateAction = (index: number, field: string, value: string) => {
    const updatedActions = [...newRuleData.actions];
    updatedActions[index] = { ...updatedActions[index], [field]: value };
    setNewRuleData({ ...newRuleData, actions: updatedActions });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: "default" as const, label: "Active", icon: CheckCircle },
      inactive: { variant: "secondary" as const, label: "Inactive", icon: AlertTriangle },
      expired: { variant: "destructive" as const, label: "Expired", icon: AlertTriangle }
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

  const getTypeBadge = (type: string) => {
    const colors = {
      earning: "bg-green-100 text-green-800",
      deduction: "bg-red-100 text-red-800", 
      contribution: "bg-blue-100 text-blue-800",
      calculation: "bg-purple-100 text-purple-800",
      proration: "bg-orange-100 text-orange-800",
      overtime: "bg-yellow-100 text-yellow-800",
      leave: "bg-cyan-100 text-cyan-800"
    };
    return (
      <Badge variant="outline" className={colors[type as keyof typeof colors]}>
        {type.toUpperCase()}
      </Badge>
    );
  };

  // AG Grid column definitions for Pay Elements
  const payElementsColumnDefs: ColDef[] = [
    {
      headerName: "Element Name",
      field: "name",
      width: 200,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="font-medium">{params.value}</div>
      )
    },
    {
      headerName: "Code",
      field: "code",
      width: 120,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="font-mono text-sm">{params.value}</div>
      )
    },
    {
      headerName: "Type",
      field: "type",
      width: 100,
      cellRenderer: (params: ICellRendererParams) => 
        params.context.getTypeBadge(params.value)
    },
    {
      headerName: "Category",
      field: "category",
      width: 140,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="text-sm">{params.value}</div>
      )
    },
    {
      headerName: "Formula",
      field: "formula",
      width: 200,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="text-sm font-mono truncate" title={params.value}>
          {params.value}
        </div>
      )
    },
    {
      headerName: "Reflect in Contract",
      field: "reflectInContract",
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        const reflectInContract = (params.data as any).reflectInContract !== false;
        return reflectInContract ? (
          <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
            Yes
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">
            No
          </Badge>
        );
      }
    },
    {
      headerName: "Status",
      field: "status",
      width: 100,
      cellRenderer: (params: ICellRendererParams) => 
        params.context.getStatusBadge(params.value)
    },
    {
      headerName: "Actions",
      field: "actions",
      width: 120,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex gap-1 justify-center">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => params.context.onClone(params.data)}
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => params.context.onEdit(params.data)}
          >
            <Edit className="w-3 h-3" />
          </Button>
        </div>
      ),
      sortable: false,
      filter: false
    }
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          {/* Left - Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rate Tables & Rules</h1>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleExportData("JSON")} className="gap-1">
              <Download className="w-4 h-4" />
              Export JSON
            </Button>
            
            <Button variant="outline" onClick={() => handleExportData("CSV")} className="gap-1">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>

            <Button variant="outline" onClick={handleImportData} className="gap-1">
              <Upload className="w-4 h-4" />
              Import
            </Button>

            <Dialog open={isTestRuleOpen} onOpenChange={setIsTestRuleOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1">
                  <TestTube className="w-4 h-4" />
                  Test Rules
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Test Rules with Sample Crew</DialogTitle>
                  <DialogDescription>
                    Test your payroll rules against sample crew data to validate calculations
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Sample Crew Member</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select crew member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="captain">James Wilson (Captain)</SelectItem>
                        <SelectItem value="engineer">Sarah Chen (Chief Engineer)</SelectItem>
                        <SelectItem value="officer">Mike Rodriguez (Second Officer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Days Worked</Label>
                      <Input type="number" placeholder="30" />
                    </div>
                    <div>
                      <Label>OT Hours</Label>
                      <Input type="number" placeholder="15" />
                    </div>
                  </div>
                  <div>
                    <Label>Test Date</Label>
                    <Input type="date" defaultValue="2025-01-15" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleTestRule} className="flex-1">
                      Run Test
                    </Button>
                    <Button variant="outline" onClick={() => setIsTestRuleOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-48 justify-start text-left font-normal"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {selectedEffectiveDate ? (
                  format(selectedEffectiveDate, "PPP")
                ) : (
                  <span>Effective Date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={selectedEffectiveDate}
                onSelect={(date) => date && setSelectedEffectiveDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Filter className="w-4 h-4 text-gray-500" />
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 rounded-none border-b bg-white">
          <TabsTrigger value="pay-elements">Pay Elements</TabsTrigger>
          <TabsTrigger value="rule-engine">Rule Engine</TabsTrigger>
          <TabsTrigger value="fx-policy">FX Policy</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-6">
          {/* Pay Elements Library Tab */}
          <TabsContent value="pay-elements" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    <span>Pay Elements Library</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{payElements.length} elements</Badge>
                    <Button 
                      size="sm" 
                      className="gap-1" 
                      onClick={() => {
                        console.log('NEW ELEMENT BUTTON CLICKED - Rate Tables & Rules');
                        console.log('About to call handleCreateElement');
                        handleCreateElement();
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      New Element
                    </Button>

                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPayElements ? (
                  <div className="text-center py-8">Loading pay elements...</div>
                ) : payElementsError ? (
                  <div className="text-center py-8 text-red-600">
                    Error loading pay elements: {payElementsError.message}
                    <br />
                    <Button onClick={() => refetch()} className="mt-2">Retry</Button>
                  </div>
                ) : (
                  <AgGridTable
                    rowData={payElements}
                    columnDefs={payElementsColumnDefs}
                    height={"400px"}
                    autoHeight={true}
                    context={{
                      onClone: handleClone,
                      onEdit: handleEditElement,
                      getTypeBadge,
                      getStatusBadge
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>



          {/* Rule Engine Tab */}
          <TabsContent value="rule-engine" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <span>Rule Engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{mockRules.length} rules</Badge>
                    <Dialog open={isNewRuleOpen} onOpenChange={setIsNewRuleOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1">
                          <Plus className="w-4 h-4" />
                          New Rule
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Create New Rule</DialogTitle>
                          <DialogDescription>
                            Define conditions and actions for automated payroll calculations
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 mt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Rule Name</Label>
                              <Input 
                                placeholder="e.g., Weekend Overtime Premium"
                                value={newRuleData.name}
                                onChange={(e) => setNewRuleData({...newRuleData, name: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Rule Type</Label>
                              <Select value={newRuleData.type} onValueChange={(value) => 
                                setNewRuleData({...newRuleData, type: value})
                              }>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="calculation">Calculation</SelectItem>
                                  <SelectItem value="proration">Proration</SelectItem>
                                  <SelectItem value="overtime">Overtime</SelectItem>
                                  <SelectItem value="leave">Leave</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label>Priority (lower = higher priority)</Label>
                            <Input 
                              type="number"
                              min="1"
                              max="100"
                              value={newRuleData.priority}
                              onChange={(e) => setNewRuleData({...newRuleData, priority: parseInt(e.target.value) || 1})}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-blue-700">Conditions (IF)</h4>
                              <Button size="sm" variant="outline" onClick={addCondition}>
                                <Plus className="w-3 h-3 mr-1" />
                                Add Condition
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {newRuleData.conditions.map((condition, index) => (
                                <div key={index} className="grid grid-cols-3 gap-3 p-3 bg-blue-50 rounded">
                                  <div>
                                    <Label className="text-xs">Field</Label>
                                    <Select value={condition.field} onValueChange={(value) => 
                                      updateCondition(index, 'field', value)
                                    }>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select field" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="DAY_OF_WEEK">Day of Week</SelectItem>
                                        <SelectItem value="WORK_HOURS">Work Hours</SelectItem>
                                        <SelectItem value="JOIN_DATE">Join Date</SelectItem>
                                        <SelectItem value="RANK">Rank</SelectItem>
                                        <SelectItem value="VESSEL_TYPE">Vessel Type</SelectItem>
                                        <SelectItem value="CONTRACT_TYPE">Contract Type</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Operator</Label>
                                    <Select value={condition.operator} onValueChange={(value) => 
                                      updateCondition(index, 'operator', value)
                                    }>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select operator" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="=">Equals (=)</SelectItem>
                                        <SelectItem value=">">{`Greater than (>)`}</SelectItem>
                                        <SelectItem value="<">{`Less than (<)`}</SelectItem>
                                        <SelectItem value=">=">{`Greater or equal (>=)`}</SelectItem>
                                        <SelectItem value="<=">{`Less or equal (<=)`}</SelectItem>
                                        <SelectItem value="IN">In list (IN)</SelectItem>
                                        <SelectItem value="NOT_IN">Not in list (NOT IN)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Value</Label>
                                    <Input 
                                      placeholder="e.g., SAT,SUN or 8"
                                      value={condition.value}
                                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-green-700">Actions (THEN)</h4>
                              <Button size="sm" variant="outline" onClick={addAction}>
                                <Plus className="w-3 h-3 mr-1" />
                                Add Action
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {newRuleData.actions.map((action, index) => (
                                <div key={index} className="grid grid-cols-4 gap-3 p-3 bg-green-50 rounded">
                                  <div>
                                    <Label className="text-xs">Action Type</Label>
                                    <Select value={action.type} onValueChange={(value) => 
                                      updateAction(index, 'type', value)
                                    }>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select action" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="MULTIPLY">Multiply</SelectItem>
                                        <SelectItem value="ADD">Add</SelectItem>
                                        <SelectItem value="SUBTRACT">Subtract</SelectItem>
                                        <SelectItem value="SET">Set Value</SelectItem>
                                        <SelectItem value="PRORATE">Prorate</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Pay Element</Label>
                                    <Select value={action.element} onValueChange={(value) => 
                                      updateAction(index, 'element', value)
                                    }>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select element" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="BASIC_WAGE">Basic Wage</SelectItem>
                                        <SelectItem value="OT_RATE">Overtime Rate</SelectItem>
                                        <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                                        <SelectItem value="TAX_RATE">Tax Rate</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Operation</Label>
                                    <Select value={action.operation} onValueChange={(value) => 
                                      updateAction(index, 'operation', value)
                                    }>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Operation" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="*">Multiply (*)</SelectItem>
                                        <SelectItem value="+">Add (+)</SelectItem>
                                        <SelectItem value="-">Subtract (-)</SelectItem>
                                        <SelectItem value="/">/</SelectItem>
                                        <SelectItem value="=">=</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Value</Label>
                                    <Input 
                                      placeholder="e.g., 2.0 or 1.5"
                                      value={action.value}
                                      onChange={(e) => updateAction(index, 'value', e.target.value)}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4 border-t">
                            <Button onClick={() => setIsNewRuleOpen(false)} className="flex-1">
                              Create Rule
                            </Button>
                            <Button variant="outline" onClick={() => setIsNewRuleOpen(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockRules.map((rule) => (
                    <Card key={rule.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{rule.name}</h4>
                              {getTypeBadge(rule.type)}
                              <Badge variant="outline" className="text-xs">
                                Priority {rule.priority}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-500">
                              Effective: {rule.effectiveDate}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(rule.status)}
                            <Button size="sm" variant="outline" onClick={() => handleClone(rule)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="text-sm font-medium mb-2 text-blue-700">Conditions (IF)</h5>
                            <div className="space-y-1">
                              {rule.conditions.map((condition, index) => (
                                <div key={index} className="text-sm p-2 bg-blue-50 rounded">
                                  {condition.field} {condition.operator} {condition.value}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium mb-2 text-green-700">Actions (THEN)</h5>
                            <div className="space-y-1">
                              {rule.actions.map((action, index) => (
                                <div key={index} className="text-sm p-2 bg-green-50 rounded">
                                  {action.type}: {action.element} {action.operation} {action.value}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FX Policy & Rounding Tab */}
          <TabsContent value="fx-policy" className="space-y-4 m-0">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    FX Policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>FX Rate Source</Label>
                    <Select defaultValue="ecb">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ecb">European Central Bank</SelectItem>
                        <SelectItem value="fed">Federal Reserve</SelectItem>
                        <SelectItem value="xe">XE.com</SelectItem>
                        <SelectItem value="manual">Manual Entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Rate Timing</Label>
                    <Select defaultValue="payroll_date">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payroll_date">Payroll Date</SelectItem>
                        <SelectItem value="earning_date">Earning Date</SelectItem>
                        <SelectItem value="monthly_avg">Monthly Average</SelectItem>
                        <SelectItem value="fixed_monthly">Fixed Monthly Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>FX Rounding</Label>
                    <Select defaultValue="4_decimal">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4_decimal">4 Decimal Places</SelectItem>
                        <SelectItem value="6_decimal">6 Decimal Places</SelectItem>
                        <SelectItem value="2_decimal">2 Decimal Places</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Auto-update rates daily</Label>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="w-5 h-5" />
                    Rounding Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Element Level Rounding</Label>
                    <Select defaultValue="nearest_cent">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nearest_cent">Nearest Cent</SelectItem>
                        <SelectItem value="up_cent">Round Up Cent</SelectItem>
                        <SelectItem value="down_cent">Round Down Cent</SelectItem>
                        <SelectItem value="nearest_dollar">Nearest Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Currency Level Rounding</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">USD</span>
                        <Select defaultValue="cent">
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cent">0.01</SelectItem>
                            <SelectItem value="nickel">0.05</SelectItem>
                            <SelectItem value="dime">0.10</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">EUR</span>
                        <Select defaultValue="cent">
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cent">0.01</SelectItem>
                            <SelectItem value="five_cent">0.05</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label>Round negative amounts down</Label>
                    <Switch />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Document Templates</span>
                  </div>
                  <Button size="sm" className="gap-1">
                    <Plus className="w-4 h-4" />
                    New Template
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {mockTemplates.map((template) => (
                    <Card key={template.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{template.name}</h4>
                            <div className="text-sm text-gray-500">
                              {template.type.replace('_', ' ').toUpperCase()}
                            </div>
                          </div>
                          <Badge variant="outline">{template.format}</Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <div className="text-xs font-medium text-gray-700">Standard Fields</div>
                            <div className="text-xs text-gray-600">
                              {template.fields.slice(0, 3).join(', ')}
                              {template.fields.length > 3 && ` +${template.fields.length - 3} more`}
                            </div>
                          </div>
                          
                          {template.customFields.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-700">Custom Fields</div>
                              <div className="text-xs text-gray-600">
                                {template.customFields.join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-3 flex justify-between">
                          <span>Modified: {template.lastModified}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleClone(template)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Custom Fields Tab */}
          <TabsContent value="custom-fields" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    <span>Custom Fields</span>
                  </div>
                  <Button size="sm" className="gap-1">
                    <Plus className="w-4 h-4" />
                    Add Field
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Crew Entity Fields</h4>
                    <div className="space-y-2">
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">License Expiry</div>
                        <div className="text-xs text-gray-500">Date field with validation</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Emergency Contact</div>
                        <div className="text-xs text-gray-500">Text field, required</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Dietary Requirements</div>
                        <div className="text-xs text-gray-500">Multi-select dropdown</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Vessel Entity Fields</h4>
                    <div className="space-y-2">
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Voyage Number</div>
                        <div className="text-xs text-gray-500">Text field, auto-increment</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Port of Registry</div>
                        <div className="text-xs text-gray-500">Dropdown, validated</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Insurance Provider</div>
                        <div className="text-xs text-gray-500">Text field</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Payroll Entity Fields</h4>
                    <div className="space-y-2">
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Cost Center</div>
                        <div className="text-xs text-gray-500">Dropdown, required</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Project Code</div>
                        <div className="text-xs text-gray-500">Text field with regex</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Budget Line</div>
                        <div className="text-xs text-gray-500">Number field</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* Edit Pay Element Dialog */}
          <Dialog open={isEditElementOpen} onOpenChange={setIsEditElementOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Pay Element</DialogTitle>
                <DialogDescription>
                  Update the pay element configuration and rules
                </DialogDescription>
              </DialogHeader>
              {editingElement && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input defaultValue={editingElement.name} />
                    </div>
                    <div>
                      <Label>Code</Label>
                      <Input defaultValue={editingElement.code} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select defaultValue={editingElement.type}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="earning">Earning</SelectItem>
                          <SelectItem value="deduction">Deduction</SelectItem>
                          <SelectItem value="contribution">Contribution</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input defaultValue={editingElement.category} />
                    </div>
                  </div>
                  <div>
                    <Label>Formula</Label>
                    <div className="space-y-2">
                      <Textarea 
                        id="edit-formula-textarea"
                        placeholder="Enter formula or use builder below"
                        defaultValue={editingElement.formula}
                        rows={3}
                      />
                      <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded text-xs">
                        <div>
                          <h4 className="font-medium mb-1">Variables</h4>
                          <div className="space-y-1 flex flex-wrap gap-1">
                            {["BASIC_WAGE", "DAYS_WORKED", "OT_HOURS", "OT_RATE", "GROSS_PAY", "RANK", "CONTRACT_TYPE", "NATIONALITY", "VESSEL_TYPE", "TAX_RATE"].map((variable) => (
                              <Button 
                                key={variable}
                                size="sm" 
                                variant="outline" 
                                className="h-6 text-xs"
                                onClick={() => {
                                  const textarea = document.getElementById('edit-formula-textarea') as HTMLTextAreaElement;
                                  if (textarea) {
                                    const cursorPos = textarea.selectionStart;
                                    const textBefore = textarea.value.substring(0, cursorPos);
                                    const textAfter = textarea.value.substring(cursorPos);
                                    textarea.value = textBefore + variable + textAfter;
                                    textarea.focus();
                                    textarea.setSelectionRange(cursorPos + variable.length, cursorPos + variable.length);
                                  }
                                }}
                              >
                                {variable}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">CBA Tables</h4>
                          <div className="space-y-1 flex flex-wrap gap-1">
                            {["CBA_TABLE.BASIC_WAGE", "CBA_TABLE.OT_RATE", "CBA_TABLE.ALLOWANCE", "CBA_TABLE.MULTIPLIER"].map((table) => (
                              <Button 
                                key={table}
                                size="sm" 
                                variant="outline" 
                                className="h-6 text-xs"
                                onClick={() => {
                                  const textarea = document.getElementById('edit-formula-textarea') as HTMLTextAreaElement;
                                  if (textarea) {
                                    const cursorPos = textarea.selectionStart;
                                    const textBefore = textarea.value.substring(0, cursorPos);
                                    const textAfter = textarea.value.substring(cursorPos);
                                    textarea.value = textBefore + table + textAfter;
                                    textarea.focus();
                                    textarea.setSelectionRange(cursorPos + table.length, cursorPos + table.length);
                                  }
                                }}
                              >
                                {table.split('.')[1]}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Functions</h4>
                          <div className="space-y-1 flex flex-wrap gap-1">
                            {[" * ", " / ", " + ", " - ", "IF()", "MAX()", "MIN()", "ROUND()"].map((func) => (
                              <Button 
                                key={func}
                                size="sm" 
                                variant="outline" 
                                className="h-6 text-xs"
                                onClick={() => {
                                  const textarea = document.getElementById('edit-formula-textarea') as HTMLTextAreaElement;
                                  if (textarea) {
                                    const cursorPos = textarea.selectionStart;
                                    const textBefore = textarea.value.substring(0, cursorPos);
                                    const textAfter = textarea.value.substring(cursorPos);
                                    textarea.value = textBefore + func + textAfter;
                                    textarea.focus();
                                    textarea.setSelectionRange(cursorPos + func.length, cursorPos + func.length);
                                  }
                                }}
                              >
                                {func.trim() || func}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        <strong>Available Variables:</strong>
                        <ul className="list-disc ml-4 mt-1 grid grid-cols-2 gap-1">
                          <li><code>BASIC_WAGE</code> - Crew basic salary</li>
                          <li><code>DAYS_WORKED</code> - Days in period</li>
                          <li><code>OT_HOURS</code> - Overtime hours</li>
                          <li><code>OT_RATE</code> - Overtime multiplier</li>
                          <li><code>GROSS_PAY</code> - Total earnings</li>
                          <li><code>RANK</code> - Crew rank</li>
                          <li><code>CONTRACT_TYPE</code> - Contract type</li>
                          <li><code>NATIONALITY</code> - Crew nationality</li>
                          <li><code>VESSEL_TYPE</code> - Type of vessel</li>
                          <li><code>TAX_RATE</code> - Tax percentage</li>
                        </ul>
                        <strong className="block mt-2">Example formulas:</strong>
                        <ul className="list-disc ml-4 mt-1">
                          <li><code>CBA_TABLE.BASIC_WAGE * DAYS_WORKED / 30</code></li>
                          <li><code>BASIC_WAGE * 1.5 * OT_HOURS</code></li>
                          <li><code>GROSS_PAY * 0.15</code></li>
                          <li><code>IF(RANK = "Captain", 1000, 500)</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Rounding</Label>
                    <Select defaultValue={editingElement.rounding}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ROUND_NEAREST_CENT">Round Nearest Cent</SelectItem>
                        <SelectItem value="ROUND_UP_CENT">Round Up Cent</SelectItem>
                        <SelectItem value="ROUND_DOWN_CENT">Round Down Cent</SelectItem>
                        <SelectItem value="ROUND_NEAREST_DOLLAR">Round Nearest Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch defaultChecked={editingElement.status === 'active'} />
                    <Label>Active</Label>
                    <span className="text-sm text-gray-500">Available for selection in payroll</span>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={() => setIsEditElementOpen(false)} className="flex-1">
                      Update Element
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditElementOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Clone Dialog */}
      <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Item</DialogTitle>
            <DialogDescription>
              Create a copy of this item with modifications
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>New Name</Label>
                <Input placeholder={`${selectedItem.name} (Copy)`} />
              </div>
              {selectedItem.code && (
                <div>
                  <Label>New Code</Label>
                  <Input placeholder={`${selectedItem.code}_COPY`} />
                </div>
              )}
              <div>
                <Label>Effective Date</Label>
                <Input type="date" defaultValue="2025-01-01" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setIsCloneDialogOpen(false)} className="flex-1">
                  Create Clone
                </Button>
                <Button variant="outline" onClick={() => setIsCloneDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Element Modal with comprehensive formula builder */}
      <PayElementModal
        isOpen={isNewElementOpen}
        onClose={() => {
          console.log('PayElementModal closing');
          setIsNewElementOpen(false);
        }}
        onSave={handleSaveElement}
        element={editingElement}
        mode={modalMode}
      />


    </div>
  );
}