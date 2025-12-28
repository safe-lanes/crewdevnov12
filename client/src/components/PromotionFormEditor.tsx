import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Settings, Plus, Trash2, Info } from "lucide-react";
import { Form, promotionA2ConfigSchema, type PromotionA2Config } from "@shared/schema";
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
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromotionFormEditorProps {
  form: Form;
  rankGroupName?: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

interface LicenseEntry {
  id: number;
  entryId: string;
  name: string;
  shortCode: string;
  description: string;
  officerMatrixLabel: string;
}

export const PromotionFormEditor: React.FC<PromotionFormEditorProps> = ({
  form,
  rankGroupName,
  onClose,
  onSave
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<string[]>([]);
  const [licenseSearchTerm, setLicenseSearchTerm] = useState("");

  // Fetch licenses from Master 016
  const { data: licenses = [] } = useQuery<LicenseEntry[]>({
    queryKey: ['/api/masters/016/data'],
  });

  const formMethods = useForm<PromotionA2Config>({
    resolver: zodResolver(promotionA2ConfigSchema),
    defaultValues: {
      higherLicenseIds: [],
      ageMin: null,
      ageMax: null,
      experienceMonths: {
        rankVessel: null,
        rankVesselType: null,
        companyService: null,
        tankerExperience: null,
      },
      minRecommendations: null,
      minChecklistVerifications: null,
      otherCriteria: [],
      cesTests: [],
    },
  });

  const { handleSubmit, watch, setValue, reset } = formMethods;

  // Load saved configuration on mount
  useEffect(() => {
    if (form.configuration) {
      try {
        const savedConfig = JSON.parse(form.configuration);
        // Check if it's the new A2 config format
        if (savedConfig.higherLicenseIds !== undefined) {
          reset(savedConfig);
          setSelectedLicenseIds(savedConfig.higherLicenseIds || []);
        }
      } catch (error) {
        console.error('Failed to parse form configuration:', error);
      }
    }
  }, [form.configuration, reset]);

  const otherCriteria = watch('otherCriteria');
  const cesTests = watch('cesTests');
  const experienceMonths = watch('experienceMonths');

  const onSubmit = (data: PromotionA2Config) => {
    const configurationJson = JSON.stringify({
      ...data,
      higherLicenseIds: selectedLicenseIds,
      rankGroupName,
      savedAt: new Date().toISOString(),
    });
    
    const actualFormId = 'originalFormId' in form ? (form as any).originalFormId : form.id;
    
    console.log('[PromotionFormEditor] Saving A2 config:', { formId: actualFormId, config: data });
    
    onSave({
      formId: actualFormId,
      configuration: configurationJson,
    });
    onClose();
  };

  // Add dynamic Other Criteria sub-item
  const addOtherCriteria = () => {
    const nextLetter = String.fromCharCode(97 + otherCriteria.length); // a, b, c...
    setValue('otherCriteria', [
      ...otherCriteria,
      { id: `a2.6${nextLetter}`, label: '' }
    ]);
  };

  const removeOtherCriteria = (index: number) => {
    setValue('otherCriteria', otherCriteria.filter((_, i) => i !== index));
  };

  const updateOtherCriteriaLabel = (index: number, label: string) => {
    const updated = [...otherCriteria];
    updated[index].label = label;
    setValue('otherCriteria', updated);
  };

  // Add dynamic CES Test sub-item
  const addCesTest = () => {
    const nextLetter = String.fromCharCode(97 + cesTests.length); // a, b, c...
    setValue('cesTests', [
      ...cesTests,
      { id: `a2.7${nextLetter}`, minScore: null }
    ]);
  };

  const removeCesTest = (index: number) => {
    setValue('cesTests', cesTests.filter((_, i) => i !== index));
  };

  const updateCesTestScore = (index: number, score: number | null) => {
    const updated = [...cesTests];
    updated[index].minScore = score;
    setValue('cesTests', updated);
  };

  // License selection handlers
  const toggleLicenseSelection = (entryId: string) => {
    setSelectedLicenseIds(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handleAddSelectedLicenses = () => {
    setValue('higherLicenseIds', selectedLicenseIds);
    setShowLicenseDialog(false);
  };

  const filteredLicenses = licenses.filter((license: LicenseEntry) =>
    license.name?.toLowerCase().includes(licenseSearchTerm.toLowerCase()) ||
    license.shortCode?.toLowerCase().includes(licenseSearchTerm.toLowerCase()) ||
    license.entryId?.toLowerCase().includes(licenseSearchTerm.toLowerCase())
  );

  // Get selected license names for display
  const getSelectedLicenseNames = () => {
    return selectedLicenseIds
      .map(id => licenses.find((l: LicenseEntry) => l.entryId === id)?.name || id)
      .join(', ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100" data-testid="text-editor-title">
                {form.name} - Form Builder
              </h2>
              {rankGroupName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Rank Group: {rankGroupName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              variant="outline"
              size="sm"
              data-testid="button-toggle-preview"
            >
              <Settings className="h-4 w-4 mr-2" />
              {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="p-6">
              <div className="border-b pb-4 mb-6">
                <h3 className="text-xl font-semibold text-[#16569e]">A2. Minimum Promotion Criteria</h3>
                <p className="text-sm text-gray-500 mt-1">Configure the required values for each promotion criterion per rank group</p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    <TableHead className="w-[50%] text-xs font-medium text-gray-600 dark:text-gray-300">Criteria</TableHead>
                    <TableHead className="w-[50%] text-xs font-medium text-gray-600 dark:text-gray-300">Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* A2.1 Higher License Criteria */}
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        A2.1 Higher License Criteria?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Select required licenses/certificates from database</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {selectedLicenseIds.length > 0 
                            ? (getSelectedLicenseNames() || `${selectedLicenseIds.length} license(s)`)
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowLicenseDialog(true)}
                            className="text-xs"
                            data-testid="button-add-license"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            ADD FROM DATABASE
                          </Button>
                          {selectedLicenseIds.length > 0 && (
                            <span className="text-xs text-gray-500 truncate max-w-[200px]">
                              {selectedLicenseIds.length} selected
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.2 Age Criteria */}
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        A2.2 Age Criteria?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Set minimum and maximum age range</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {watch('ageMin') !== null || watch('ageMax') !== null
                            ? `${watch('ageMin') ?? '—'} to ${watch('ageMax') ?? '—'} years`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            className="h-8 w-20 text-xs"
                            value={watch('ageMin') ?? ''}
                            onChange={(e) => setValue('ageMin', e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-age-min"
                          />
                          <span className="text-xs text-gray-500">to</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            className="h-8 w-20 text-xs"
                            value={watch('ageMax') ?? ''}
                            onChange={(e) => setValue('ageMax', e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-age-max"
                          />
                          <span className="text-xs text-gray-500">years</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.3 Experience & Sea Service Criteria - Header */}
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        A2.3 Experience & Sea Service Criteria?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Configure experience requirements in months</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {/* A2.3a Minimum Rank Experience (Vessel) */}
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                    <TableCell className="text-sm pl-8">A2.3a Minimum Rank Experience (Vessel)?</TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {experienceMonths.rankVessel !== null
                            ? `${experienceMonths.rankVessel} months`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Months"
                            className="h-8 w-24 text-xs"
                            value={experienceMonths.rankVessel ?? ''}
                            onChange={(e) => setValue('experienceMonths.rankVessel', e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-exp-rank-vessel"
                          />
                          <span className="text-xs text-gray-500">Months</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.3b Minimum Rank Experience (Vessel Type) */}
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                    <TableCell className="text-sm pl-8">A2.3b Minimum Rank Experience (Vessel Type)?</TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {experienceMonths.rankVesselType !== null
                            ? `${experienceMonths.rankVesselType} months`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Months"
                            className="h-8 w-24 text-xs"
                            value={experienceMonths.rankVesselType ?? ''}
                            onChange={(e) => setValue('experienceMonths.rankVesselType', e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-exp-rank-vessel-type"
                          />
                          <span className="text-xs text-gray-500">Months</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.3c Minimum Company Service */}
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                    <TableCell className="text-sm pl-8">A2.3c Minimum Company Service in previous rank?</TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {experienceMonths.companyService !== null
                            ? `${experienceMonths.companyService} months`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Months"
                            className="h-8 w-24 text-xs"
                            value={experienceMonths.companyService ?? ''}
                            onChange={(e) => setValue('experienceMonths.companyService', e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-exp-company"
                          />
                          <span className="text-xs text-gray-500">Months</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.3d Minimum Tanker Experience */}
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                    <TableCell className="text-sm pl-8">A2.3d Minimum Tanker Experience?</TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {experienceMonths.tankerExperience !== null
                            ? `${experienceMonths.tankerExperience} months`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Months"
                            className="h-8 w-24 text-xs"
                            value={experienceMonths.tankerExperience ?? ''}
                            onChange={(e) => setValue('experienceMonths.tankerExperience', e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-exp-tanker"
                          />
                          <span className="text-xs text-gray-500">Months</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.4 Recommendations Criteria */}
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        A2.4 Recommendations Criteria?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Minimum number of recommendations required</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {watch('minRecommendations') !== null
                            ? `${watch('minRecommendations')} recommendations`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <Input
                          type="number"
                          placeholder="Min Recommendations"
                          className="h-8 w-40 text-xs"
                          value={watch('minRecommendations') ?? ''}
                          onChange={(e) => setValue('minRecommendations', e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-min-recommendations"
                        />
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.5 Promotion Checklist Progress */}
                  <TableRow>
                    <TableCell className="text-sm">A2.5 Promotion Checklist Progress</TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {watch('minChecklistVerifications') !== null
                            ? `${watch('minChecklistVerifications')} verifications`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <Input
                          type="number"
                          placeholder="Min No. of Verifications"
                          className="h-8 w-40 text-xs"
                          value={watch('minChecklistVerifications') ?? ''}
                          onChange={(e) => setValue('minChecklistVerifications', e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-min-verifications"
                        />
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.5a Promotion Checklist Completed */}
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50">
                    <TableCell className="text-sm pl-8">
                      <div className="flex items-center gap-2">
                        A2.5a Promotion Checklist Completed?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Auto-calculated based on checklist completion</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">(Auto-calculated)</TableCell>
                  </TableRow>

                  {/* A2.6 Other Criteria - Header */}
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        A2.6 Other Criteria?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Add custom criteria as needed</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {otherCriteria.length > 0 
                            ? `${otherCriteria.length} criteria configured`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addOtherCriteria}
                          className="text-xs"
                          data-testid="button-add-criteria"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Criteria
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.6 Dynamic Sub-items */}
                  {otherCriteria.map((criteria, index) => (
                    <TableRow key={criteria.id} className="bg-gray-50/50 dark:bg-gray-800/50">
                      <TableCell className="text-sm pl-8">{criteria.id.toUpperCase()}</TableCell>
                      <TableCell>
                        {isPreviewMode ? (
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {criteria.label || <span className="text-gray-400 italic">Not configured</span>}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder="Enter criteria description"
                              className="h-8 flex-1 text-xs"
                              value={criteria.label}
                              onChange={(e) => updateOtherCriteriaLabel(index, e.target.value)}
                              data-testid={`input-other-criteria-${index}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOtherCriteria(index)}
                              className="h-8 w-8 p-0"
                              data-testid={`button-remove-criteria-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* A2.7 CES / Language Tests - Header */}
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        A2.7 CES / Language Tests Criteria?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Add CES/Language test requirements with minimum scores</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPreviewMode ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {cesTests.length > 0 
                            ? `${cesTests.length} tests configured`
                            : <span className="text-gray-400 italic">Not configured</span>
                          }
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCesTest}
                          className="text-xs"
                          data-testid="button-add-ces"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Test
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* A2.7 Dynamic CES Test Sub-items */}
                  {cesTests.map((test, index) => (
                    <TableRow key={test.id} className="bg-gray-50/50 dark:bg-gray-800/50">
                      <TableCell className="text-sm pl-8">{test.id.toUpperCase()}</TableCell>
                      <TableCell>
                        {isPreviewMode ? (
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {test.minScore !== null 
                              ? `Min Score: ${test.minScore}`
                              : <span className="text-gray-400 italic">Not configured</span>
                            }
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Min Score"
                              className="h-8 w-24 text-xs"
                              value={test.minScore ?? ''}
                              onChange={(e) => updateCesTestScore(index, e.target.value ? parseInt(e.target.value) : null)}
                              data-testid={`input-ces-minscore-${index}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCesTest(index)}
                              className="h-8 w-8 p-0"
                              data-testid={`button-remove-ces-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* A2.8 Training & Other Documents Verification */}
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        A2.8 Training & Other Documents Verification?
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Verification status will be checked at runtime</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">(Auto-verified from training records)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* License Selection Dialog */}
      <Dialog open={showLicenseDialog} onOpenChange={setShowLicenseDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Add License & DCE from Database</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search */}
            <Input
              placeholder="Search certificates..."
              value={licenseSearchTerm}
              onChange={(e) => setLicenseSearchTerm(e.target.value)}
              className="h-9"
              data-testid="input-license-search"
            />

            {/* Selection info */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{selectedLicenseIds.length} selected of {licenses.length} available</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLicenseIds(licenses.map((l: LicenseEntry) => l.entryId))}
                  data-testid="button-select-all"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLicenseIds([])}
                  data-testid="button-clear-all"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* License Table */}
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Certificate / Document</TableHead>
                    <TableHead className="text-xs">ABBR</TableHead>
                    <TableHead className="text-xs">Requirement</TableHead>
                    <TableHead className="text-xs">Officer Matrix Label</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLicenses.map((license: LicenseEntry) => (
                    <TableRow 
                      key={license.entryId}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => toggleLicenseSelection(license.entryId)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedLicenseIds.includes(license.entryId)}
                          onCheckedChange={() => toggleLicenseSelection(license.entryId)}
                          data-testid={`checkbox-license-${license.entryId}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs">{license.entryId}</TableCell>
                      <TableCell className="text-xs">{license.name}</TableCell>
                      <TableCell className="text-xs">{license.shortCode}</TableCell>
                      <TableCell className="text-xs">{license.description}</TableCell>
                      <TableCell className="text-xs">{license.officerMatrixLabel}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLicenseDialog(false)}
                data-testid="button-cancel-license"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAddSelectedLicenses}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-add-selected"
              >
                Add Selected
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
