import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditIcon, Plus, Eye, Grip } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form as FormComponent,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Form, RankGroup, AvailableRank } from "@shared/schema";
import { FormEditorFactory } from "@/components/FormEditorFactory";
import { formTemplates, createFormEditor } from "@/utils/formEditorGenerator";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SideBarComponent from '../../components/Navbar/SideBarComponent';
import MainLayout from "@/components/main/MainLayout";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import { AgGridTable } from "@/components/AgGrid/AgGridTable";
import { ColDef, GridApi, GridReadyEvent, ICellEditorParams, ICellRendererParams } from "ag-grid-community";

const rankGroupSchema = z.object({
  name: z.string().min(1, "Rank group name is required"),
  ranks: z.array(z.string()).min(1, "At least one rank must be selected"),
});

// Interface for Rank Master data
interface RankMasterData {
  id: string;
  rank: string;
  rankId: string;
  applicableToCompany: boolean;
  label: string;
}

export const AdminModule = (): JSX.Element => {
  const [location] = useLocation();
  const [selectedAdminPage, setSelectedAdminPage] = useState("forms");
  const [selectedRankAdminTab, setSelectedRankAdminTab] = useState("rank-master");
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [editingRankGroup, setEditingRankGroup] = useState<string | null>(null);
  const [isAddRankGroupOpen, setIsAddRankGroupOpen] = useState(false);
  const [selectedFormForRankGroup, setSelectedFormForRankGroup] = useState<string | null>(null);
  const [showCreateFormDialog, setShowCreateFormDialog] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [createFormType, setCreateFormType] = useState<"template" | "blank">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  
  // Rank Master state
  const [rankMasterData, setRankMasterData] = useState<RankMasterData[]>([
    { id: "1", rank: "Master", rankId: "S1", applicableToCompany: true, label: "Master" },
    { id: "2", rank: "Chief Officer", rankId: "S2", applicableToCompany: true, label: "Chief Off" },
    { id: "3", rank: "Second Officer", rankId: "S3", applicableToCompany: true, label: "2nd Off" },
    { id: "4", rank: "Third Officer", rankId: "S4", applicableToCompany: true, label: "3rd Off" },
    { id: "5", rank: "Fourth Officer", rankId: "S5", applicableToCompany: false, label: "" },
    { id: "6", rank: "Deck Cadet", rankId: "S6", applicableToCompany: true, label: "Deck Cadet" },
    { id: "7", rank: "Chief Engineer", rankId: "S7", applicableToCompany: true, label: "Ch Eng" },
  ]);
  const [isRankMasterEditing, setIsRankMasterEditing] = useState(false);
  const [rankMasterGridApi, setRankMasterGridApi] = useState<GridApi | null>(null);
  
  const queryClient = useQueryClient();

  // Rank Master handlers
  const handleRankMasterGridReady = (event: GridReadyEvent) => {
    setRankMasterGridApi(event.api);
  };

  const handleNewRank = () => {
    const newRank: RankMasterData = {
      id: Date.now().toString(),
      rank: "",
      rankId: "",
      applicableToCompany: false,
      label: ""
    };
    setRankMasterData(prev => {
      const newData = [...prev, newRank];
      // Start editing the first cell of the new row after the state updates
      setTimeout(() => {
        if (rankMasterGridApi) {
          const rowIndex = newData.length - 1;
          rankMasterGridApi.startEditingCell({
            rowIndex: rowIndex,
            colKey: 'rank'
          });
        }
      }, 100);
      return newData;
    });
    setIsRankMasterEditing(true);
  };

  const handleEditRank = () => {
    setIsRankMasterEditing(true);
  };

  const handleSaveRank = () => {
    setIsRankMasterEditing(false);
    rankMasterGridApi?.stopEditing();
  };

  // Rank Master column definitions
  const rankMasterColumnDefs: ColDef[] = [
    {
      headerName: "",
      width: 40,
      cellClass: 'text-center cursor-move',
      rowDrag: isRankMasterEditing,
      sortable: false,
      filter: false,
      pinned: 'left',
      menuTabs: [],
    },
    {
      headerName: "Rank",
      field: "rank",
      flex: 1,
      editable: isRankMasterEditing,
      singleClickEdit: true,
      cellStyle: { backgroundColor: '#E3F2FD' },
    },
    {
      headerName: "Rank ID (Sail)",
      field: "rankId", 
      flex: 1,
      editable: isRankMasterEditing,
      singleClickEdit: true,
      cellStyle: { backgroundColor: '#E3F2FD' },
    },
    {
      headerName: "Applicable to Company",
      field: "applicableToCompany",
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => {
        return (
          <div className="flex items-center justify-center h-full">
            <input
              type="checkbox"
              checked={params.value}
              disabled={!isRankMasterEditing}
              onChange={(e) => {
                if (isRankMasterEditing) {
                  const newData = [...rankMasterData];
                  const rowIndex = newData.findIndex(row => row.id === params.data.id);
                  if (rowIndex !== -1) {
                    newData[rowIndex].applicableToCompany = e.target.checked;
                    setRankMasterData(newData);
                  }
                }
              }}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
          </div>
        );
      }
    },
    {
      headerName: "Label",
      field: "label",
      flex: 1,
      editable: isRankMasterEditing,
      singleClickEdit: true,
    }
  ];

  // Fetch forms data from API
  const { data: formsData = [], isLoading, error } = useQuery<Form[]>({
    queryKey: ["/api/forms"],
    enabled: selectedAdminPage === "forms",
    queryFn: async () => {
      const response = await fetch("/api/forms");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  const { data: availableRanks = [] } = useQuery<AvailableRank[]>({
    queryKey: ["/api/available-ranks"],
    queryFn: async () => {
      const response = await fetch("/api/available-ranks");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  const createRankGroupMutation = useMutation({
    mutationFn: async (data: { formId: number; name: string; ranks: string[] }) => {
      return await apiRequest("POST", "/api/rank-groups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setIsAddRankGroupOpen(false);
      setSelectedFormForRankGroup(null);
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: { name: string; versionNo: string; versionDate: string }) => {
      return await apiRequest("POST", "/api/forms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setShowCreateFormDialog(false);
      setNewFormName("");
      setSelectedTemplate("");
    },
  });

  const handleEditClick = (form: Form) => {
    setEditingForm(form);
    setEditingRankGroup("Senior Officers"); // Default to Senior Officers for now
  };

  const handleAddRankGroup = (formName: string) => {
    setSelectedFormForRankGroup(formName);
    setIsAddRankGroupOpen(true);
  };

  const getRankGroupRanks = (rankGroupName: string) => {
    switch (rankGroupName) {
      case "Senior Officers":
        return "Master, Chief Officer, Chief Engineer";
      case "Junior Officers":
        return "2nd Officer, 3rd Officer, 2nd Engineer, 3rd Engineer";
      case "Ratings":
        return "Bosun, AB, OS, Oiler, Wiper";
      default:
        return "No ranks assigned";
    }
  };

  const handleCreateForm = () => {
    if (!newFormName.trim()) return;

    const formData = {
      name: newFormName.trim(),
      versionNo: "00",
      versionDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace(/ /g, '-')
    };

    createFormMutation.mutate(formData);

    // If using a template, generate the form editor
    if (createFormType === "template" && selectedTemplate) {
      try {
        createFormEditor(selectedTemplate);
        console.log(`Form Editor created for: ${selectedTemplate}`);
      } catch (error) {
        console.error("Error creating form editor:", error);
      }
    }
  };

  const handleFormSave = (formData: any) => {
    console.log("Saving form configuration:", formData);
    // TODO: Implement form configuration save logic
    setEditingForm(null);
  };

  const handleCloseEditor = () => {
    setEditingForm(null);
    setEditingRankGroup(null);
  };

  // Add Rank Group Dialog Component
  const AddRankGroupDialog = () => {
    const form = useForm({
      resolver: zodResolver(rankGroupSchema),
      defaultValues: {
        name: "",
        ranks: [],
      },
    });

    const onSubmit = (data: { name: string; ranks: string[] }) => {
      if (selectedFormForRankGroup) {
        // Find the form ID based on the form name
        const formId = 1; // For now, assume all rank groups belong to form ID 1
        createRankGroupMutation.mutate({
          formId,
          name: data.name,
          ranks: data.ranks,
        });
      }
    };

    return (
      <Dialog open={isAddRankGroupOpen} onOpenChange={setIsAddRankGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Rank Group to {selectedFormForRankGroup}</DialogTitle>
          </DialogHeader>
          <FormComponent {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rank Group Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter rank group name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ranks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Ranks</FormLabel>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {availableRanks.map((rank) => (
                        <div key={rank.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`rank-${rank.id}`}
                            checked={field.value?.includes(rank.name) || false}
                            onCheckedChange={(checked) => {
                              const currentValue = field.value || [];
                              if (checked) {
                                field.onChange([...currentValue, rank.name]);
                              } else {
                                field.onChange(currentValue.filter((r: string) => r !== rank.name));
                              }
                            }}
                          />
                          <label htmlFor={`rank-${rank.id}`} className="text-sm">
                            {rank.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddRankGroupOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createRankGroupMutation.isPending}>
                  {createRankGroupMutation.isPending ? "Adding..." : "Add Rank Group"}
                </Button>
              </div>
            </form>
          </FormComponent>
        </DialogContent>
      </Dialog>
    );
  };

  // Group forms by name for hierarchical display
  const groupedForms = formsData.reduce((acc, form) => {
    if (!acc[form.name]) {
      acc[form.name] = [];
    }
    acc[form.name].push(form);
    return acc;
  }, {} as Record<string, typeof formsData>);

  const renderRankAdminModule = () => (
    <div>
      <SectionTitleComponents title={"Rank Administration"}>
        <div className="flex items-center gap-4 ml-[19px] mr-[19px]">
          {/* Inline Tab Switcher */}
          <div className="flex items-center bg-gray-100 rounded-full p-1 border border-gray-300">
            {[
              { id: "rank-master", label: "Rank Master" },
              { id: "company", label: "Company" },
              { id: "vessel", label: "Vessel" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedRankAdminTab(tab.id)}
                className={`px-4 text-xs font-medium rounded-full transition-all duration-200 h-8 flex items-center ${
                  selectedRankAdminTab === tab.id
                    ? "bg-[#16569e] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {selectedRankAdminTab === "rank-master" && (
            <div className="flex gap-2">
              <Button
                onClick={isRankMasterEditing ? handleSaveRank : handleEditRank}
                className="h-8 bg-[#52baf3] hover:bg-[#3da8e3] text-white text-xs"
              >
                {isRankMasterEditing ? "Save" : "Edit Rank"}
              </Button>
              <Button
                onClick={handleNewRank}
                className="h-8 bg-[#4ade80] hover:bg-[#22c55e] text-white text-xs"
              >
                + New Rank
              </Button>
            </div>
          )}
        </div>
      </SectionTitleComponents>

      {/* Tab Content */}
      <div className="p-4 pl-0">
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="p-4 pl-0">
            {selectedRankAdminTab === "rank-master" && (
              <div className="h-[600px]">
                <AgGridTable
                  rowData={rankMasterData}
                  columnDefs={rankMasterColumnDefs}
                  onGridReady={handleRankMasterGridReady}
                  enableExport={false}
                  enableSideBar={false}
                  enableStatusBar={false}
                  enableRowGrouping={false}
                  enablePivoting={false}
                  rowSelection={false}
                  animateRows={true}
                  theme="alpine"
                  gridOptions={{
                    rowDragManaged: true,
                    animateRows: true,
                    onRowDragEnd: (event) => {
                      const newData = [...rankMasterData];
                      const fromIndex = event.overIndex;
                      const toIndex = event.overIndex;
                      
                      if (fromIndex !== undefined && toIndex !== undefined && fromIndex !== toIndex) {
                        const [movedItem] = newData.splice(fromIndex, 1);
                        newData.splice(toIndex, 0, movedItem);
                        setRankMasterData(newData);
                      }
                    },
                    onCellValueChanged: (event) => {
                      const newData = [...rankMasterData];
                      const rowIndex = newData.findIndex(row => row.id === event.data.id);
                      if (rowIndex !== -1) {
                        newData[rowIndex] = { ...newData[rowIndex], [event.colDef.field!]: event.newValue };
                        setRankMasterData(newData);
                      }
                    }
                  }}
                />
              </div>
            )}
            
            {selectedRankAdminTab === "company" && (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Company</h3>
                <p className="text-gray-500">Content will be implemented here</p>
              </div>
            )}
            
            {selectedRankAdminTab === "vessel" && (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Vessel</h3>
                <p className="text-gray-500">Content will be implemented here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderFormsTable = () => (
    <div>
      <SectionTitleComponents title={"Forms Configuration"}>
        <div className="flex items-center gap-2 ml-[19px] mr-[19px]">
          <Button
            variant="outline"
            onClick={() => setShowCreateFormDialog(true)}
            className="h-8 border-[#e1e8ed] text-[#16569e] flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">Create Form</span>
          </Button>
          <Button
            variant="outline"
            className="h-8 border-[#e1e8ed] text-[#16569e] flex items-center gap-2"
          >
            <span className="text-xs">Back</span>
          </Button>
        </div>
      </SectionTitleComponents>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center p-8">
          <div className="text-[#4f5863] text-sm">Loading forms...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex justify-center items-center p-8">
          <div className="text-red-500 text-sm">Error loading forms. Please try again.</div>
          <div className="text-red-500 text-xs mt-2">
            {error instanceof Error ? error.message : String(error)}
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="p-4 pl-0 bg-[#f7fafc]">
            <Table className="bg-white rounded-lg shadow-md overflow-hidden">
              <TableHeader className="bg-[#52baf3]">
                <TableRow>
                  <TableHead className="text-white text-xs font-normal">
                    Form
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal">
                    Rank Group
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal">
                    Version No
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal">
                    Version Date
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal w-24">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {Object.entries(groupedForms).map(([formName, forms]) => (
                  <React.Fragment key={formName}>
                    {/* First level - Form name with rowspan */}
                    <TableRow className="border-b border-gray-200 bg-white hover:bg-gray-50">
                      <TableCell
                        className="text-[#4f5863] text-[13px] font-semibold py-3 border-r border-gray-200 bg-[#ffffff]"
                        rowSpan={forms.length}
                      >
                        <div className="flex items-center justify-between">
                          <span>{formName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={() => handleAddRankGroup(formName)}
                          >
                            <Plus className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      </TableCell>
                      {/* Second level - First rank group */}
                      <TableCell className="text-[#4f5863] text-[13px] font-normal pl-6">
                        <div className="flex items-center justify-between">
                          <span>{forms[0].rankGroup}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 ml-2"
                                >
                                  <Eye className="h-4 w-4 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Ranks: {getRankGroupRanks(forms[0].rankGroup)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#4f5863] text-[13px] font-normal">
                        {forms[0].versionNo}
                      </TableCell>
                      <TableCell className="text-[#4f5863] text-[13px] font-normal">
                        {forms[0].versionDate}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleEditClick(forms[0])}
                          >
                            <EditIcon className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Remaining rank groups for this form */}
                    {forms.slice(1).map((form) => (
                      <TableRow key={form.id} className="border-b border-gray-200 bg-white hover:bg-gray-50">
                        <TableCell className="text-[#4f5863] text-[13px] font-normal pl-6">
                          <div className="flex items-center justify-between">
                            <span>{form.rankGroup}</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 ml-2"
                                  >
                                    <Eye className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ranks: {getRankGroupRanks(form.rankGroup)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#4f5863] text-[13px] font-normal">
                          {form.versionNo}
                        </TableCell>
                        <TableCell className="text-[#4f5863] text-[13px] font-normal">
                          {form.versionDate}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditClick(form)}
                            >
                              <EditIcon className="h-[18px] w-[18px] text-gray-500" />
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
      )}

      {/* Pagination */}
      {!isLoading && !error && (
        <div className="mt-4 text-xs font-normal font-['Mulish',Helvetica] text-black">
          {formsData.length > 0 ? `1 to ${formsData.length} of ${formsData.length}` : "0 to 0 of 0"}
        </div>
      )}
    </div>
  );

  return (
    <>
      <SideBarComponent selectedAdminPage={selectedAdminPage} setSelectedAdminPage={setSelectedAdminPage} allowedPages={["forms", "rank-admin", "masters", "training-matrix"]} />
      <MainLayout>
        {selectedAdminPage === "forms" && renderFormsTable()}
        {selectedAdminPage === "rank-admin" && renderRankAdminModule()}
      </MainLayout>

      {/* Main content */}
      {/* <main className="absolute top-[67px] left-[67px] w-[calc(100%-67px)] h-[calc(100%-67px)]">
       
        </main> */}

      {/* Form Editor Modal */}
      {editingForm && (
        <FormEditorFactory
          formName={editingForm.name}
          form={editingForm}
          rankGroupName={editingRankGroup || undefined}
          onClose={handleCloseEditor}
          onSave={handleFormSave}
        />
      )}

      {/* Add Rank Group Dialog */}
      <AddRankGroupDialog />

      {/* Create Form Dialog */}
      <Dialog open={showCreateFormDialog} onOpenChange={setShowCreateFormDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Form Name</FormLabel>
              <Input
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="Enter form name"
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Creation Type</FormLabel>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="template"
                    checked={createFormType === "template"}
                    onChange={(e) => setCreateFormType(e.target.value as "template" | "blank")}
                  />
                  <span>Use Template</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="blank"
                    checked={createFormType === "blank"}
                    onChange={(e) => setCreateFormType(e.target.value as "template" | "blank")}
                  />
                  <span>Blank Form</span>
                </label>
              </div>
            </div>

            {createFormType === "template" && (
              <div className="space-y-2">
                <FormLabel>Select Template</FormLabel>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(formTemplates).map((templateName) => (
                      <SelectItem key={templateName} value={templateName}>
                        {templateName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateFormDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateForm}
              disabled={
                !newFormName.trim() ||
                (createFormType === "template" && !selectedTemplate) ||
                createFormMutation.isPending
              }
            >
              {createFormMutation.isPending ? "Creating..." : "Create Form"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};