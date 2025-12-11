import React, { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Settings, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Form } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

// Promotion form schema for the builder
const promotionFormSchema = z.object({
  // Part A: Criteria Review
  seafarerInfoFields: z.array(z.string()).default([
    'name', 'dob', 'currentRank', 'promotionRank', 'vessel'
  ]),
  criteriaRows: z.array(z.object({
    id: z.string(),
    criteria: z.string(),
    configurable: z.boolean().default(true),
    visible: z.boolean().default(true),
  })).default([]),
  trainingNeedsEnabled: z.boolean().default(true),
  commentsEnabled: z.boolean().default(true),

  // Part B: Approval
  approverOptions: z.array(z.string()).default([
    'Marine Superintendent',
    'Technical Superintendent',
    'Crew Manager',
    'Fleet Manager'
  ]),
  vesselTypesEnabled: z.boolean().default(true),
  vesselClassesEnabled: z.boolean().default(true),

  // Part C: Execution
  executionFields: z.array(z.string()).default([
    'confirmationStatus', 'vesselAssignment', 'promotionDate', 'promotionTiming'
  ]),

  // Form metadata
  formVersion: z.string().default("00"),
  formDate: z.string().default(new Date().toISOString().split('T')[0]),
});

type PromotionFormData = z.infer<typeof promotionFormSchema>;

interface PromotionFormEditorProps {
  form: Form;
  rankGroupName?: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const PromotionFormEditor: React.FC<PromotionFormEditorProps> = ({
  form,
  rankGroupName,
  onClose,
  onSave
}) => {
  const [activeSection, setActiveSection] = useState("A");
  const [isConfigMode, setIsConfigMode] = useState(true); // Start in config mode for form builder

  // Section refs for continuous scroll
  const partARef = useRef<HTMLDivElement>(null);
  const partBRef = useRef<HTMLDivElement>(null);
  const partCRef = useRef<HTMLDivElement>(null);
  const continuousScrollContainerRef = useRef<HTMLDivElement>(null);

  // Default criteria rows based on the Promotion Review Form structure
  const defaultCriteriaRows = [
    { id: 'a2.1', criteria: 'A2.1 Higher License Criteria?', configurable: true, visible: true },
    { id: 'a2.2', criteria: 'A2.2 Age Criteria?', configurable: true, visible: true },
    { id: 'a2.3', criteria: 'A2.3 Experience & Sea Service Criteria?', configurable: true, visible: true },
    { id: 'a2.3a', criteria: 'A2.3a  Minimum Rank Experience (Vessel)?', configurable: true, visible: true },
    { id: 'a2.3b', criteria: 'A2.3b  Minimum Rank Experience (Vessel Type)?', configurable: true, visible: true },
    { id: 'a2.3c', criteria: 'A2.3c  Minimum Company Service in previous rank?', configurable: true, visible: true },
    { id: 'a2.3d', criteria: 'A2.3d  Minimum Tanker Experience?', configurable: true, visible: true },
    { id: 'a2.4', criteria: 'A2.4 Recommendations Criteria?', configurable: true, visible: true },
    { id: 'a2.5a', criteria: 'A2.5a Promotion Checklist Completed?', configurable: true, visible: true },
    { id: 'a2.6', criteria: 'A2.6 Other Criteria?', configurable: true, visible: true },
    { id: 'a2.7', criteria: 'A2.7 CES / Language Tests Criteria?', configurable: true, visible: true },
    { id: 'a2.8', criteria: 'A2.8 Training & Other Documents Verification?', configurable: true, visible: true },
  ];

  const formMethods = useForm<PromotionFormData>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      seafarerInfoFields: ['name', 'dob', 'currentRank', 'promotionRank', 'vessel'],
      criteriaRows: defaultCriteriaRows,
      trainingNeedsEnabled: true,
      commentsEnabled: true,
      approverOptions: [
        'Marine Superintendent',
        'Technical Superintendent',
        'Crew Manager',
        'Fleet Manager'
      ],
      vesselTypesEnabled: true,
      vesselClassesEnabled: true,
      executionFields: ['confirmationStatus', 'vesselAssignment', 'promotionDate', 'promotionTiming'],
      formVersion: form.versionNo || "00",
      formDate: new Date().toISOString().split('T')[0],
    },
  });

  const { handleSubmit, watch, setValue, reset } = formMethods;

  // Load saved configuration on mount
  useEffect(() => {
    if (form.configuration) {
      try {
        const savedConfig = JSON.parse(form.configuration);
        reset({
          ...savedConfig,
          formVersion: form.versionNo || savedConfig.formVersion || "00",
          formDate: form.versionDate || savedConfig.formDate || new Date().toISOString().split('T')[0],
        });
      } catch (error) {
        console.error('Failed to parse form configuration:', error);
      }
    }
  }, [form.configuration, form.versionNo, form.versionDate, reset]);

  const criteriaRows = watch('criteriaRows');
  const trainingNeedsEnabled = watch('trainingNeedsEnabled');
  const commentsEnabled = watch('commentsEnabled');
  const approverOptions = watch('approverOptions');
  const vesselTypesEnabled = watch('vesselTypesEnabled');
  const vesselClassesEnabled = watch('vesselClassesEnabled');

  // Intersection Observer for continuous scroll tracking
  useEffect(() => {
    if (!continuousScrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisible = entries[0];
        
        entries.forEach((entry) => {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        });

        if (mostVisible && mostVisible.intersectionRatio > 0.3) {
          const sectionId = mostVisible.target.getAttribute('data-section-id');
          if (sectionId) {
            setActiveSection(sectionId);
          }
        }
      },
      {
        root: continuousScrollContainerRef.current,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-100px 0px -100px 0px'
      }
    );

    const sections = [partARef.current, partBRef.current, partCRef.current];
    sections.forEach(section => {
      if (section) observer.observe(section);
    });

    return () => {
      sections.forEach(section => {
        if (section) observer.unobserve(section);
      });
    };
  }, []);

  const onSubmit = (data: PromotionFormData) => {
    // Serialize configuration to JSON string for backend storage
    const configurationJson = JSON.stringify({
      ...data,
      rankGroupName,
      savedAt: new Date().toISOString(),
    });
    
    // Use originalFormId if available (from expanded forms data), otherwise use id
    const actualFormId = 'originalFormId' in form ? (form as any).originalFormId : form.id;
    
    console.log('[PromotionFormEditor] Saving form:', { formId: actualFormId, expandedId: form.id, form: form.name });
    
    onSave({
      formId: actualFormId,
      configuration: configurationJson,
    });
    onClose();
  };

  const handleSectionClick = (sectionId: string, ref: React.RefObject<HTMLDivElement>) => {
    setActiveSection(sectionId);
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleCriteriaVisibility = (index: number) => {
    const updated = [...criteriaRows];
    updated[index].visible = !updated[index].visible;
    setValue('criteriaRows', updated);
  };

  const addCriteriaRow = () => {
    const newId = `a2.${criteriaRows.length + 1}`;
    setValue('criteriaRows', [
      ...criteriaRows,
      { id: newId, criteria: 'New Criteria', configurable: true, visible: true }
    ]);
  };

  const removeCriteriaRow = (index: number) => {
    setValue('criteriaRows', criteriaRows.filter((_, i) => i !== index));
  };

  const updateCriteriaText = (index: number, newText: string) => {
    const updated = [...criteriaRows];
    updated[index].criteria = newText;
    setValue('criteriaRows', updated);
  };

  const toggleCriteriaConfigurable = (index: number) => {
    const updated = [...criteriaRows];
    updated[index].configurable = !updated[index].configurable;
    setValue('criteriaRows', updated);
  };

  const addApproverOption = () => {
    const newApprover = prompt('Enter new approver designation:');
    if (newApprover && newApprover.trim()) {
      setValue('approverOptions', [...approverOptions, newApprover.trim()]);
    }
  };

  const removeApproverOption = (index: number) => {
    setValue('approverOptions', approverOptions.filter((_, i) => i !== index));
  };

  const sections = [
    { id: 'A', title: 'Part A: Criteria Review', letter: 'A' },
    { id: 'B', title: 'Part B: Approval', letter: 'B' },
    { id: 'C', title: 'Part C: Execution', letter: 'C' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              data-testid="button-close-editor"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900" data-testid="text-editor-title">
                {form.name} - Form Builder
              </h2>
              {rankGroupName && (
                <p className="text-sm text-gray-500">Rank Group: {rankGroupName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setIsConfigMode(!isConfigMode)}
              variant="outline"
              size="sm"
              data-testid="button-toggle-config"
            >
              <Settings className="h-4 w-4 mr-2" />
              {isConfigMode ? 'Preview Mode' : 'Config Mode'}
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-save-form"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Form
            </Button>
          </div>
        </div>

        {/* Stepper Navigation */}
        <div className="flex justify-center border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex space-x-8">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id, 
                  section.id === 'A' ? partARef : 
                  section.id === 'B' ? partBRef : partCRef
                )}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
                data-testid={`button-section-${section.id.toLowerCase()}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                  activeSection === section.id
                    ? 'bg-white text-blue-600'
                    : 'bg-gray-300 text-gray-700'
                }`}>
                  {section.letter}
                </div>
                <span className="text-sm font-medium">{section.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area with Continuous Scroll */}
        <div 
          ref={continuousScrollContainerRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {/* Part A: Criteria Review */}
          <div ref={partARef} data-section-id="A" className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="border-b pb-4 mb-6">
                  <h3 className="text-xl font-semibold text-[#16569e]">Part A: Criteria Review</h3>
                  <p className="text-sm text-gray-500 mt-1">Configure promotion criteria assessment fields</p>
                </div>

                {/* A1: Seafarer Information */}
                <div className="mb-6 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-base font-medium text-[#16569e] mb-3">A1. Seafarer Information (Read-Only Display)</h4>
                  <p className="text-sm text-gray-600">These fields will display crew member data automatically.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">Name</Badge>
                    <Badge variant="secondary">DOB / Age</Badge>
                    <Badge variant="secondary">Current Rank</Badge>
                    <Badge variant="secondary">Promotion to Rank</Badge>
                    <Badge variant="secondary">Current Vessel</Badge>
                  </div>
                </div>

                {/* A2: Minimum Promotion Criteria */}
                <div className="mb-6 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-medium text-[#16569e]">A2. Minimum Promotion Criteria</h4>
                    <Button
                      onClick={addCriteriaRow}
                      variant="outline"
                      size="sm"
                      data-testid="button-add-criteria"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Criteria
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Criteria</TableHead>
                        <TableHead className="w-[20%]">Configurable</TableHead>
                        <TableHead className="w-[20%]">Visible</TableHead>
                        <TableHead className="w-[20%]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {criteriaRows.map((row, index) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {isConfigMode ? (
                              <Input
                                value={row.criteria}
                                onChange={(e) => updateCriteriaText(index, e.target.value)}
                                className="text-sm"
                                data-testid={`input-criteria-${index}`}
                              />
                            ) : (
                              <span className="text-sm">{row.criteria}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={row.configurable}
                              onCheckedChange={() => toggleCriteriaConfigurable(index)}
                              disabled={!isConfigMode}
                              data-testid={`checkbox-configurable-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => toggleCriteriaVisibility(index)}
                              variant="ghost"
                              size="sm"
                              disabled={!isConfigMode}
                              data-testid={`button-toggle-visibility-${index}`}
                            >
                              {row.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => removeCriteriaRow(index)}
                              variant="ghost"
                              size="sm"
                              disabled={!isConfigMode}
                              data-testid={`button-remove-criteria-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* A3: Training Needs */}
                <div className="mb-6 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-medium text-[#16569e]">A3. Training Needs</h4>
                    <Checkbox
                      checked={trainingNeedsEnabled}
                      onCheckedChange={(checked) => setValue('trainingNeedsEnabled', checked as boolean)}
                      disabled={!isConfigMode}
                      data-testid="checkbox-training-needs"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {trainingNeedsEnabled ? 'Enabled - Will show training needs table' : 'Disabled'}
                  </p>
                </div>

                {/* A4: Comments & Recommendations */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-medium text-[#16569e]">A4. Comments & Recommendations</h4>
                    <Checkbox
                      checked={commentsEnabled}
                      onCheckedChange={(checked) => setValue('commentsEnabled', checked as boolean)}
                      disabled={!isConfigMode}
                      data-testid="checkbox-comments"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {commentsEnabled ? 'Enabled - Will show comments section' : 'Disabled'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Part B: Approval */}
          <div ref={partBRef} data-section-id="B" className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="border-b pb-4 mb-6">
                  <h3 className="text-xl font-semibold text-[#16569e]">Part B: Approval</h3>
                  <p className="text-sm text-gray-500 mt-1">Configure approval workflow settings</p>
                </div>

                {/* B1: Approver Options */}
                <div className="mb-6 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-medium text-[#16569e]">B1. Approver Options</h4>
                    <Button
                      onClick={addApproverOption}
                      variant="outline"
                      size="sm"
                      disabled={!isConfigMode}
                      data-testid="button-add-approver"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Approver
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Available approver designations:</p>
                  <div className="space-y-2">
                    {approverOptions.map((option, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <Badge variant="outline">{option}</Badge>
                        {isConfigMode && (
                          <Button
                            onClick={() => removeApproverOption(index)}
                            variant="ghost"
                            size="sm"
                            data-testid={`button-remove-approver-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* B2: Suitable For - Vessel Types */}
                <div className="mb-6 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-medium text-[#16569e]">B2.1 Vessel Types Selection</h4>
                    <Checkbox
                      checked={vesselTypesEnabled}
                      onCheckedChange={(checked) => setValue('vesselTypesEnabled', checked as boolean)}
                      disabled={!isConfigMode}
                      data-testid="checkbox-vessel-types"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {vesselTypesEnabled ? 'Enabled - Will show vessel types selection' : 'Disabled'}
                  </p>
                </div>

                {/* B2: Suitable For - Vessel Classes */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-medium text-[#16569e]">B2.2 Vessel Classes Selection</h4>
                    <Checkbox
                      checked={vesselClassesEnabled}
                      onCheckedChange={(checked) => setValue('vesselClassesEnabled', checked as boolean)}
                      disabled={!isConfigMode}
                      data-testid="checkbox-vessel-classes"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {vesselClassesEnabled ? 'Enabled - Will show vessel classes selection' : 'Disabled'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Part C: Execution */}
          <div ref={partCRef} data-section-id="C" className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="border-b pb-4 mb-6">
                  <h3 className="text-xl font-semibold text-[#16569e]">Part C: Execution</h3>
                  <p className="text-sm text-gray-500 mt-1">Configure promotion execution fields</p>
                </div>

                {/* C1: Confirmation & Assignment Fields */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-base font-medium text-[#16569e] mb-3">C1. Confirmation & Assignment Fields</h4>
                  <p className="text-sm text-gray-600 mb-3">Standard execution fields:</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox checked disabled />
                      <Badge variant="outline">Promotion Confirmed (Yes/Waitlist/Rejected)</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox checked disabled />
                      <Badge variant="outline">Vessel Assigned</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox checked disabled />
                      <Badge variant="outline">Date of Promotion</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox checked disabled />
                      <Badge variant="outline">Promotion Timing (On-board/Prior Joining)</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">These fields are required and cannot be disabled.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
