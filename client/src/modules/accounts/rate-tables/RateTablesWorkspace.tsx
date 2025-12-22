/**
 * Rate Tables & Rules Workspace
 * Purpose: No-code rule library for payroll calculations with vessel group management
 */

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { VesselGroupModal } from '@/components/vessel/VesselGroupModal';
import { usePayElementsStore, type PayElement } from '@/store/payElements';
import { PayElementModal } from '@/components/contract-data/PayElementModal';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Hash,
  Users,
  Zap,
  Shield,
  Eye
} from "lucide-react";

// PayElement interface now imported from global store

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

interface VesselGroup {
  id: string;
  name: string;
  vesselIds: string[];
}

// Mock data now comes from global store

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

// Helper functions
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

export function RateTablesWorkspace() {
  // Global pay elements store
  const { 
    elements: payElements, 
    addElement, 
    updateElement, 
    getActiveElements,
    getElementsForClient
  } = usePayElementsStore();

  const [activeTab, setActiveTab] = useState("pay-elements");
  const [vesselGroups, setVesselGroups] = useState<VesselGroup[]>([]);
  const [isVesselGroupModalOpen, setIsVesselGroupModalOpen] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState('all');
  const [selectedEffectiveDate, setSelectedEffectiveDate] = useState('2025-01-01');
  const [isNewElementOpen, setIsNewElementOpen] = useState(false);
  const [isTestRuleOpen, setIsTestRuleOpen] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editingElement, setEditingElement] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [newElementData, setNewElementData] = useState({
    name: "",
    code: "",
    type: "earning",
    category: "",
    formula: "",
    rounding: "ROUND_NEAREST_CENT",
    status: "active"
  });

  // Rules management state
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [newRuleData, setNewRuleData] = useState({
    name: "",
    type: "calculation",
    priority: 1,
    status: "active",
    effectiveDate: new Date().toISOString().split('T')[0],
    conditions: [{ field: "", operator: "equals", value: "" }],
    actions: [{ type: "ADD", element: "", operation: "SET", value: "" }]
  });

  const baseVesselOptions = [
    { value: 'all', label: 'All Vessels' },
    { value: 'mv-atlantic-star', label: 'MV Atlantic Star' },
    { value: 'mv-atlantic-explorer', label: 'MV Atlantic Explorer' },
    { value: 'mv-pacific-voyager', label: 'MV Pacific Voyager' },
    { value: 'mv-northern-star', label: 'MV Northern Star' },
    { value: 'mv-southern-cross', label: 'MV Southern Cross' }
  ];

  // Combine base vessels with created vessel groups
  const vesselOptions = [
    ...baseVesselOptions,
    ...vesselGroups.map(group => ({
      value: group.id,
      label: `${group.name} (${group.vesselIds.length} vessels)`
    }))
  ];

  const handleClone = (item: any) => {
    setSelectedItem(item);
    setIsCloneDialogOpen(true);
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

  const handleVesselGroupCreated = useCallback((groupData: Omit<VesselGroup, 'id'>) => {
    const newGroup: VesselGroup = {
      ...groupData,
      id: `vg-${Date.now()}` // Generate unique ID
    };
    setVesselGroups(prev => [...prev, newGroup]);
    // Automatically select the newly created group
    setSelectedVessel(newGroup.id);
    console.log('Created vessel group:', newGroup);
    console.log('Group successfully saved and selected in dropdown');
  }, []);

  const handleCreateElement = useCallback(() => {
    setEditingElement(null);
    setModalMode('create');
    setIsNewElementOpen(true);
  }, []);

  const handleEditElement = useCallback((element: PayElement) => {
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
      applicable: element.status === 'active'
    };
    setEditingElement(modalElement);
    setModalMode('edit');
    setIsNewElementOpen(true);
  }, []);

  const handleSaveElement = useCallback((element: any) => {
    if (modalMode === 'create') {
      // Add new element to the store
      const newElement: PayElement = {
        id: `custom-${Date.now()}`,
        name: element.payElementName,
        code: element.payElementCode,
        type: element.type,
        category: element.category,
        formula: element.formula,
        rounding: element.rounding,
        status: element.applicable ? 'active' : 'inactive',
        effectiveDate: new Date().toISOString().split('T')[0],
        ceiling: undefined,
        floor: undefined
      };
      addElement(newElement);
      console.log('Created new element:', newElement);
    } else {
      // Update existing element
      const updatedElement: PayElement = {
        id: element.payElementId,
        name: element.payElementName,
        code: element.payElementCode,
        type: element.type,
        category: element.category,
        formula: element.formula,
        rounding: element.rounding,
        status: element.applicable ? 'active' : 'inactive',
        effectiveDate: new Date().toISOString().split('T')[0],
        ceiling: undefined,
        floor: undefined
      };
      updateElement(updatedElement.id, updatedElement);
      console.log('Updated element:', updatedElement);
    }
    setIsNewElementOpen(false);
  }, [modalMode, addElement, updateElement]);

  const handleCreateOrUpdateElement = useCallback(() => {
    // Validate required fields
    if (!newElementData.name.trim() || !newElementData.code.trim()) {
      console.error('Name and Code are required fields');
      return;
    }

    if (editingElement) {
      // Update existing element
      const updatedElement: PayElement = {
        ...editingElement,
        name: newElementData.name.trim(),
        code: newElementData.code.trim().toUpperCase(),
        type: newElementData.type as "earning" | "deduction" | "contribution",
        category: newElementData.category.trim() || "Uncategorized",
        formula: newElementData.formula.trim() || "No Formula",
        rounding: newElementData.rounding,
        status: newElementData.status as "active" | "inactive"
      };

      updateElement(editingElement.id, updatedElement);
      console.log('Updated pay element:', updatedElement);
    } else {
      // Create new pay element
      const newElement: PayElement = {
        id: `PE${String(payElements.length + 1).padStart(3, '0')}`,
        name: newElementData.name.trim(),
        code: newElementData.code.trim().toUpperCase(),
        type: newElementData.type as "earning" | "deduction" | "contribution",
        category: newElementData.category.trim() || "Uncategorized",
        formula: newElementData.formula.trim() || "No Formula",
        rounding: newElementData.rounding,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: newElementData.status as "active" | "inactive"
      };

      addElement(newElement);
      console.log('Created pay element:', newElement);
    }

    // Reset form and close modal
    handleCloseElementModal();
  }, [newElementData, payElements.length, editingElement]);

  const handleCloseElementModal = useCallback(() => {
    setNewElementData({
      name: "",
      code: "",
      type: "earning",
      category: "",
      formula: "",
      rounding: "ROUND_NEAREST_CENT",
      status: "active"
    });
    setEditingElement(null);
    setIsNewElementOpen(false);
  }, []);

  // Rules management handlers
  const handleEditRule = useCallback((rule: any) => {
    setEditingRule(rule);
    setNewRuleData({
      name: rule.name,
      type: rule.type,
      priority: rule.priority,
      status: rule.status,
      effectiveDate: rule.effectiveDate,
      conditions: [...rule.conditions],
      actions: [...rule.actions]
    });
    setIsNewRuleOpen(true);
  }, []);

  const handleCreateOrUpdateRule = useCallback(() => {
    // Validate required fields
    if (!newRuleData.name.trim()) {
      console.error('Rule name is required');
      return;
    }

    if (editingRule) {
      // Update existing rule
      console.log('Updated rule:', { ...editingRule, ...newRuleData });
    } else {
      // Create new rule
      const newRule = {
        id: `R${String(mockRules.length + 1).padStart(3, '0')}`,
        ...newRuleData
      };
      console.log('Created rule:', newRule);
    }

    // Reset form and close modal
    handleCloseRuleModal();
  }, [newRuleData, editingRule]);

  const handleCloseRuleModal = useCallback(() => {
    setNewRuleData({
      name: "",
      type: "calculation",
      priority: 1,
      status: "active",
      effectiveDate: new Date().toISOString().split('T')[0],
      conditions: [{ field: "", operator: "equals", value: "" }],
      actions: [{ type: "ADD", element: "", operation: "SET", value: "" }]
    });
    setEditingRule(null);
    setIsNewRuleOpen(false);
  }, []);

  const handleAddCondition = () => {
    setNewRuleData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: "", operator: "equals", value: "" }]
    }));
  };

  const handleRemoveCondition = (index: number) => {
    setNewRuleData(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateCondition = (index: number, field: string, value: string) => {
    setNewRuleData(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => 
        i === index ? { ...condition, [field]: value } : condition
      )
    }));
  };

  const handleAddAction = () => {
    setNewRuleData(prev => ({
      ...prev,
      actions: [...prev.actions, { type: "ADD", element: "", operation: "SET", value: "" }]
    }));
  };

  const handleRemoveAction = (index: number) => {
    setNewRuleData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateAction = (index: number, field: string, value: string) => {
    setNewRuleData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      )
    }));
  };

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
          <Select value={selectedEffectiveDate} onValueChange={setSelectedEffectiveDate}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Effective Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-01-01">January 2025</SelectItem>
              <SelectItem value="2024-12-01">December 2024</SelectItem>
              <SelectItem value="2024-11-01">November 2024</SelectItem>
              <SelectItem value="2024-10-01">October 2024</SelectItem>
              <SelectItem value="2024-09-01">September 2024</SelectItem>
              <SelectItem value="2024-08-01">August 2024</SelectItem>
            </SelectContent>
          </Select>

          <Filter className="w-4 h-4 text-gray-500" />
          
          {activeTab === "pay-elements" && (
            <div className="flex items-center gap-2">
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vesselOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVesselGroupModalOpen(true)}
                className="h-9 w-9 p-0"
                title="Create vessel group"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-6 rounded-none border-b bg-white mx-6">
          <TabsTrigger value="pay-elements">Pay Elements</TabsTrigger>
          <TabsTrigger value="cba-tables">CBA Tables</TabsTrigger>
          <TabsTrigger value="rule-engine">Rule Engine</TabsTrigger>
          <TabsTrigger value="fx-policy">FX Policy</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto px-6">
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
                    <Button size="sm" className="gap-1" onClick={handleCreateElement}>
                      <Plus className="w-4 h-4" />
                      New Element
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-8 gap-4 p-3 bg-gray-100 rounded-lg font-medium text-sm">
                    <div>Element Name</div>
                    <div>Code</div>
                    <div>Type</div>
                    <div>Category</div>
                    <div>Formula</div>
                    <div>Rounding</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Actions</div>
                  </div>
                  
                  {payElements.map((element) => (
                    <div key={element.id} className="grid grid-cols-8 gap-4 p-3 border rounded-lg hover:bg-gray-50">
                      <div className="font-medium">{element.name}</div>
                      <div className="font-mono text-sm">{element.code}</div>
                      <div>{getTypeBadge(element.type)}</div>
                      <div className="text-sm">{element.category}</div>
                      <div className="text-sm font-mono truncate" title={element.formula}>
                        {element.formula}
                      </div>
                      <div className="text-xs">{element.rounding.replace(/_/g, ' ')}</div>
                      <div className="text-center">{getStatusBadge(element.status)}</div>
                      <div className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="outline" onClick={() => handleClone(element)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditElement(element)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CBA Tables Tab */}
          <TabsContent value="cba-tables" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <span>CBA Tables</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{mockCBATables.length} tables</Badge>
                    <Button size="sm" className="gap-1">
                      <Plus className="w-4 h-4" />
                      New CBA Table
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockCBATables.map((table) => (
                    <Card key={table.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{table.name}</h4>
                            <div className="text-sm text-gray-500 flex items-center gap-4">
                              <span>Rank: {table.rank}</span>
                              <span>Years at Sea: {table.yearsAtSea}</span>
                              <span>Currency: {table.currency}</span>
                              <span>Version: {table.version}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(table.status)}
                            <Button size="sm" variant="outline" onClick={() => handleClone(table)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4">
                          {Object.entries(table.rates).map(([position, rate]) => (
                            <div key={position} className="p-2 bg-gray-50 rounded">
                              <div className="text-sm font-medium">{position}</div>
                              <div className="font-mono text-lg text-green-600">
                                ${rate.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-3 flex justify-between">
                          <span>Effective: {table.effectiveDate}</span>
                          {table.expiryDate && <span>Expires: {table.expiryDate}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingRule ? "Edit Rule" : "Create Rule"}
                          </DialogTitle>
                          <DialogDescription>
                            Define automated payroll calculation rules with conditions and actions
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Basic Information */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Rule Name</Label>
                              <Input 
                                placeholder="Overtime Rate Calculation"
                                value={newRuleData.name}
                                onChange={(e) => setNewRuleData({...newRuleData, name: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Type</Label>
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

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label>Priority</Label>
                              <Select value={String(newRuleData.priority)} onValueChange={(value) => 
                                setNewRuleData({...newRuleData, priority: parseInt(value)})
                              }>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 (Highest)</SelectItem>
                                  <SelectItem value="2">2</SelectItem>
                                  <SelectItem value="3">3</SelectItem>
                                  <SelectItem value="4">4</SelectItem>
                                  <SelectItem value="5">5 (Lowest)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Effective Date</Label>
                              <Input 
                                type="date"
                                value={newRuleData.effectiveDate}
                                onChange={(e) => setNewRuleData({...newRuleData, effectiveDate: e.target.value})}
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Status</Label>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm ${newRuleData.status === "active" ? "text-gray-500" : "text-gray-900 font-medium"}`}>
                                    Inactive
                                  </span>
                                  <Switch
                                    checked={newRuleData.status === "active"}
                                    onCheckedChange={(checked) => 
                                      setNewRuleData(prev => ({ 
                                        ...prev, 
                                        status: checked ? "active" : "inactive" 
                                      }))
                                    }
                                  />
                                  <span className={`text-sm ${newRuleData.status === "active" ? "text-green-600 font-medium" : "text-gray-500"}`}>
                                    Active
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Conditions Section */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-base font-medium text-blue-700">Conditions (IF)</Label>
                              <Button type="button" size="sm" variant="outline" onClick={handleAddCondition}>
                                <Plus className="w-3 h-3 mr-1" />
                                Add Condition
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {newRuleData.conditions.map((condition, index) => (
                                <div key={index} className="flex gap-2 items-center p-3 bg-blue-50 rounded">
                                  <Select 
                                    value={condition.field} 
                                    onValueChange={(value) => handleUpdateCondition(index, 'field', value)}
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue placeholder="Select field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="work_hours">Work Hours</SelectItem>
                                      <SelectItem value="day_of_week">Day of Week</SelectItem>
                                      <SelectItem value="rank">Rank</SelectItem>
                                      <SelectItem value="years_at_sea">Years at Sea</SelectItem>
                                      <SelectItem value="vessel_type">Vessel Type</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Select 
                                    value={condition.operator} 
                                    onValueChange={(value) => handleUpdateCondition(index, 'operator', value)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="equals">Equals</SelectItem>
                                      <SelectItem value="greater_than">Greater than</SelectItem>
                                      <SelectItem value="less_than">Less than</SelectItem>
                                      <SelectItem value="contains">Contains</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input 
                                    placeholder="Value"
                                    value={condition.value}
                                    onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                    className="flex-1"
                                  />
                                  {newRuleData.conditions.length > 1 && (
                                    <Button 
                                      type="button" 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => handleRemoveCondition(index)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Actions Section */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-base font-medium text-green-700">Actions (THEN)</Label>
                              <Button type="button" size="sm" variant="outline" onClick={handleAddAction}>
                                <Plus className="w-3 h-3 mr-1" />
                                Add Action
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {newRuleData.actions.map((action, index) => (
                                <div key={index} className="flex gap-2 items-center p-3 bg-green-50 rounded">
                                  <Select 
                                    value={action.type} 
                                    onValueChange={(value) => handleUpdateAction(index, 'type', value)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ADD">ADD</SelectItem>
                                      <SelectItem value="MULTIPLY">MULTIPLY</SelectItem>
                                      <SelectItem value="SET">SET</SelectItem>
                                      <SelectItem value="SUBTRACT">SUBTRACT</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input 
                                    placeholder="Element (e.g., BASIC_PAY)"
                                    value={action.element}
                                    onChange={(e) => handleUpdateAction(index, 'element', e.target.value)}
                                    className="flex-1"
                                  />
                                  <Select 
                                    value={action.operation} 
                                    onValueChange={(value) => handleUpdateAction(index, 'operation', value)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SET">SET</SelectItem>
                                      <SelectItem value="PERCENTAGE">PERCENTAGE</SelectItem>
                                      <SelectItem value="FIXED">FIXED</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input 
                                    placeholder="Value"
                                    value={action.value}
                                    onChange={(e) => handleUpdateAction(index, 'value', e.target.value)}
                                    className="w-24"
                                  />
                                  {newRuleData.actions.length > 1 && (
                                    <Button 
                                      type="button" 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => handleRemoveAction(index)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button onClick={handleCreateOrUpdateRule} className="flex-1">
                              {editingRule ? "Update Rule" : "Create Rule"}
                            </Button>
                            <Button variant="outline" onClick={handleCloseRuleModal}>
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
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => handleClone(rule)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleEditRule(rule)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                            </div>
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
                        <div className="text-xs text-gray-500">Contact information</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Medical Certificate</div>
                        <div className="text-xs text-gray-500">File upload field</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Payroll Fields</h4>
                    <div className="space-y-2">
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Bonus Percentage</div>
                        <div className="text-xs text-gray-500">Numeric field (0-100%)</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Overtime Multiplier</div>
                        <div className="text-xs text-gray-500">Decimal field</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Special Allowance</div>
                        <div className="text-xs text-gray-500">Currency field</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Vessel Fields</h4>
                    <div className="space-y-2">
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Voyage Number</div>
                        <div className="text-xs text-gray-500">Text field</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Port of Call</div>
                        <div className="text-xs text-gray-500">Dropdown selection</div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="font-medium text-sm">Charter Party</div>
                        <div className="text-xs text-gray-500">Boolean field</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

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
        onClose={() => setIsNewElementOpen(false)}
        onSave={handleSaveElement}
        element={editingElement}
        mode={modalMode}
      />

      {/* Vessel Group Modal */}
      <VesselGroupModal
        open={isVesselGroupModalOpen}
        onOpenChange={setIsVesselGroupModalOpen}
        onSave={handleVesselGroupCreated}
      />
    </div>
  );
}