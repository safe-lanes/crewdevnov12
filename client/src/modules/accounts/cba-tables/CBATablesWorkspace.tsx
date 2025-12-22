import React, { useState } from 'react';
import { Ship, Calendar, Download, Upload, Plus, Edit, Copy, FileText, CheckCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CBATableModal } from "@/components/cba-tables/CBATableModal";

interface CBATable {
  id: string;
  name: string;
  type: "basic_wages" | "overtime_rates" | "allowances";
  rank: string;
  yearsAtSea: string;
  currency: string;
  version: number;
  status: "active" | "inactive" | "expired";
  effectiveDate: string;
  expiryDate?: string;
  rates: Record<string, number>;
}

const mockCBATables: CBATable[] = [
  {
    id: "1",
    name: "Officers Basic Wages 2025",
    type: "basic_wages",
    rank: "Officer",
    yearsAtSea: "5-8",
    currency: "USD",
    version: 1,
    status: "active",
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
    rates: {
      "Captain": 8000,
      "Chief Officer": 6000,
      "Second Officer": 4500,
      "Third Officer": 3500
    }
  },
  {
    id: "2",
    name: "Ratings Basic Wages 2025",
    type: "basic_wages",
    rank: "Rating",
    yearsAtSea: "All",
    currency: "USD",
    version: 1,
    status: "active",
    effectiveDate: "2025-01-01",
    expiryDate: "2025-12-31",
    rates: {
      "Bosun": 2800,
      "AB Seaman": 2200,
      "OS": 1800,
      "Cook": 2500
    }
  }
];

export function CBATablesWorkspace() {
  const [isCBATableModalOpen, setIsCBATableModalOpen] = useState(false);
  const [editingCBATable, setEditingCBATable] = useState<CBATable | null>(null);
  const [cbaModalMode, setCbaModalMode] = useState<'create' | 'edit'>('create');

  const handleCreateCBATable = () => {
    console.log('Creating new CBA table - button clicked!');
    setEditingCBATable(null);
    setCbaModalMode('create');
    setIsCBATableModalOpen(true);
  };

  const handleEditCBATable = (table: CBATable) => {
    console.log('Editing CBA table:', table);
    setEditingCBATable(table);
    setCbaModalMode('edit');
    setIsCBATableModalOpen(true);
  };

  const handleSaveCBATable = (tableData: any) => {
    if (cbaModalMode === 'create') {
      console.log('Creating new CBA table:', tableData);
      // In a real app, this would call an API
    } else {
      console.log('Updating CBA table:', tableData);
      // In a real app, this would call an API
    }
    setIsCBATableModalOpen(false);
  };

  const handleClone = (table: CBATable) => {
    console.log('Cloning table:', table);
    // Create a clone with new ID and name
    const clonedTable = {
      ...table,
      id: `${table.id}-clone`,
      name: `${table.name} (Copy)`,
      status: 'inactive' as const
    };
    handleEditCBATable(clonedTable);
  };

  const handleExportData = (format: string) => {
    console.log(`Exporting CBA tables as ${format}`);
  };

  const handleImportData = () => {
    console.log("Importing CBA tables");
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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* Left - Title and Context */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CBA Tables</h1>
            <div className="flex items-center gap-6 text-sm text-gray-600 mt-1">
              <div className="flex items-center gap-1">
                <Ship className="w-4 h-4" />
                <span><strong>Client:</strong> Maritime Corp</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span><strong>Effective Date:</strong> 2025-01-01</span>
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
            </div>
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

            <Button onClick={handleCreateCBATable} className="gap-1">
              <Plus className="w-4 h-4" />
              New CBA Table
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                <span>CBA Tables</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{mockCBATables.length} tables</Badge>
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
                        <Button size="sm" variant="outline" onClick={() => handleEditCBATable(table)}>
                          <Edit className="w-3 h-3" />
                        </Button>
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
      </div>

      {/* CBA Table Modal */}
      <CBATableModal
        isOpen={isCBATableModalOpen}
        onClose={() => setIsCBATableModalOpen(false)}
        onSave={handleSaveCBATable}
        table={editingCBATable}
        mode={cbaModalMode}
      />
    </div>
  );
}