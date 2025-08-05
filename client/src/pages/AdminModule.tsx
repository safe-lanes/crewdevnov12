import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditIcon, Plus, Eye } from "lucide-react";
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
import { FormEditor } from "./FormEditor";
import { FormEditorFactory } from "@/components/FormEditorFactory";
import { formTemplates, createFormEditor } from "@/utils/formEditorGenerator";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const rankGroupSchema = z.object({
  name: z.string().min(1, "Rank group name is required"),
  ranks: z.array(z.string()).min(1, "At least one rank must be selected"),
});

export const AdminModule = (): JSX.Element => {
  const [location] = useLocation();
  const [selectedAdminPage, setSelectedAdminPage] = useState("forms");
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [editingRankGroup, setEditingRankGroup] = useState<string | null>(null);
  const [isAddRankGroupOpen, setIsAddRankGroupOpen] = useState(false);
  const [selectedFormForRankGroup, setSelectedFormForRankGroup] = useState<string | null>(null);
  const [showCreateFormDialog, setShowCreateFormDialog] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [createFormType, setCreateFormType] = useState<"template" | "blank">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const queryClient = useQueryClient();

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
                            checked={field.value.includes(rank.name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, rank.name]);
                              } else {
                                field.onChange(field.value.filter((r) => r !== rank.name));
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

  const renderFormsTable = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-['Mulish',Helvetica] font-bold text-black text-[22px] ml-[19px] mr-[19px]">
          Forms Configuration
        </h1>
        <div className="flex items-center gap-2 ml-[19px] mr-[19px]">
          <Button
            variant="outline"
            onClick={() => setShowCreateFormDialog(true)}
            className="h-10 border-[#e1e8ed] text-[#16569e] flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Create Form</span>
          </Button>
          <Button
            variant="outline"
            className="h-10 border-[#e1e8ed] text-[#16569e] flex items-center gap-2"
          >
            <span className="text-sm">Back</span>
          </Button>
        </div>
      </div>

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
          <CardContent className="p-4 bg-[#f7fafc]">
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
    <div className="bg-transparent flex flex-row justify-center w-full">
      <div className="overflow-hidden bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%] w-[1440px] h-[900px] relative">
        {/* Header */}
        <header className="w-full h-[67px] bg-[#E8E8E8] border-b-2 border-[#5DADE2]">
          <div className="flex items-center h-full">
            {/* Logo */}
            <div className="flex items-center ml-4">
              <img
                className="w-14 h-10"
                alt="Logo"
                src="/figmaAssets/group-2.png"
              />
            </div>

            {/* Navigation Menu */}
            <nav className="flex ml-8">
              {/* Crewing Section */}
              <Link href="/">
                <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#E8E8E8] border-r border-gray-300 cursor-pointer hover:bg-gray-300">
                  <div className="w-6 h-6 mb-1">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="7" height="7" rx="1" fill="#6B7280"/>
                      <rect x="14" y="3" width="7" height="7" rx="1" fill="#6B7280"/>
                      <rect x="3" y="14" width="7" height="7" rx="1" fill="#6B7280"/>
                      <rect x="14" y="14" width="7" height="7" rx="1" fill="#6B7280"/>
                    </svg>
                  </div>
                  <div className="text-[#4f5863] text-[10px] font-normal font-['Mulish',Helvetica]">
                    Crewing
                  </div>
                </div>
              </Link>

              {/* Appraisals Section */}
              <Link href="/">
                <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#E8E8E8] border-r border-gray-300 cursor-pointer hover:bg-gray-300">
                  <div className="w-6 h-6 mb-1">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#6B7280"/>
                      <path d="M14 2V8H20" fill="#6B7280"/>
                      <path d="M16 11H8V13H16V11Z" fill="#6B7280"/>
                      <path d="M16 15H8V17H16V15Z" fill="#6B7280"/>
                    </svg>
                  </div>
                  <div className="text-[#4f5863] text-[10px] font-normal font-['Roboto',Helvetica]">
                    Appraisals
                  </div>
                </div>
              </Link>

              {/* Admin Section (Active) */}
              <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#5DADE2] border-r border-gray-300">
                <div className="w-6 h-6 mb-1">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1L15.09 8.26L23 9L17 14.74L18.18 22.02L12 19L5.82 22.02L7 14.74L1 9L8.91 8.26L12 1Z" fill="white"/>
                  </svg>
                </div>
                <div className="text-white text-[10px] font-normal font-['Mulish',Helvetica]">
                  Admin
                </div>
              </div>
            </nav>

            {/* User Profile */}
            <div className="absolute top-2.5 right-[38px]">
              <img
                className="w-[38px] h-[37px]"
                alt="User"
                src="/figmaAssets/group-3.png"
              />
            </div>
          </div>
        </header>

        {/* Left sidebar */}
        <aside className="w-[67px] absolute left-0 top-[66px] h-[calc(100vh-66px)]">
          {/* Forms Section (Active) */}
          <div 
            className={`w-full h-[79px] flex flex-col items-center justify-center cursor-pointer ${
              selectedAdminPage === "forms" ? "bg-[#52baf3]" : "bg-[#16569e] hover:bg-[#1e5fa8]"
            }`}
            onClick={() => setSelectedAdminPage("forms")}
          >
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white"/>
                <path d="M14 2V8H20" fill="white"/>
                <path d="M16 11H8V13H16V11Z" fill={selectedAdminPage === "forms" ? "#52baf3" : "white"}/>
                <path d="M16 15H8V17H16V15Z" fill={selectedAdminPage === "forms" ? "#52baf3" : "white"}/>
              </svg>
            </div>
            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica]">
              Forms
            </div>
          </div>
          
          {/* Dark blue section for future admin pages */}
          <div className="w-full h-[calc(100%-79px)] bg-[#16569e]">
          </div>
        </aside>

        {/* Main content */}
        <main className="absolute top-[67px] left-[67px] w-[calc(100%-67px)] h-[calc(100%-67px)]">
          {selectedAdminPage === "forms" && renderFormsTable()}
        </main>
      </div>

      {/* Form Editor Modal */}
      {editingForm && (
        <FormEditorFactory
          formName={editingForm.name}
          form={editingForm}
          rankGroupName={editingRankGroup}
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
    </div>
  );
};