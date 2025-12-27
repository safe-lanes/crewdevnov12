import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { PartBProps } from "./types";

const PartBComponent: React.FC<PartBProps> = ({
  formMethods,
  isConfigMode,
  sectionVisibility,
  toggleSectionVisibility,
  effectivenessOptions,
  getDynamicSectionLetter,
  trainings,
  targets,
  trainingComments,
  setTrainingComments,
  targetComments,
  setTargetComments,
  addTraining,
  updateTraining,
  deleteTraining,
  addTarget,
  updateTarget,
  deleteTarget,
  setShowEffectivenessDialog,
}) => {

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="pb-3 sm:pb-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-3 sm:gap-0">
          <h3 className="text-lg sm:text-xl font-semibold" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('B')}: Information at Start of Appraisal Period</h3>
          {isConfigMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partB')}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7 shrink-0"
              style={{ borderColor: '#52baf3', color: '#52baf3' }}
              data-testid="button-toggle-part-b"
            >
              {sectionVisibility.partB ? 'Hide Section' : 'Show Section'}
            </Button>
          )}
        </div>
        <div style={{ color: '#16569e' }} className="text-xs sm:text-sm">Add below at the start of the Appraisal Period except the Evaluation which must be completed at the end of the Appraisal Period</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      {sectionVisibility.partB && (
        <>
          {sectionVisibility.partB1 && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
                <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>B1. Trainings conducted prior joining vessel (To Assess Effectiveness)</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {isConfigMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSectionVisibility('partB1')}
                      className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
                      style={{ borderColor: '#52baf3', color: '#52baf3' }}
                      data-testid="button-toggle-b1"
                    >
                      {sectionVisibility.partB1 ? 'Hide Section' : 'Show Section'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={addTraining}
                    variant="outline"
                    size="sm"
                    className="text-gray-600 border-gray-300 text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
                    data-testid="button-add-training"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Add Training</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {trainings.map((training, index) => (
                        <React.Fragment key={training.id}>
                          <tr className="border-b border-gray-200 bg-white hover:bg-gray-50">
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <Input
                                value={training.training}
                                onChange={(e) => updateTraining(training.id, "training", e.target.value)}
                                placeholder={`Training ${index + 1}`}
                                className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                data-testid={`input-training-${index}`}
                              />
                            </td>
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <Select
                                value={training.evaluation}
                                onValueChange={(value) => updateTraining(training.id, "evaluation", value)}
                                onOpenChange={(open) => {
                                  if (isConfigMode && open && index === 0) {
                                    setShowEffectivenessDialog(true);
                                  }
                                }}
                              >
                                <SelectTrigger 
                                  className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                                  style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                                  data-testid={`select-training-eval-${index}`}
                                >
                                  <SelectValue placeholder="Select Rating" />
                                </SelectTrigger>
                                <SelectContent>
                                  {effectivenessOptions.map((option, optionIndex) => (
                                    <SelectItem key={optionIndex} value={option.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setTrainingComments(prev => ({
                                    ...prev,
                                    [training.id]: prev[training.id] || ""
                                  }))}
                                  className="h-6 w-6"
                                  data-testid={`button-training-comment-${index}`}
                                >
                                  <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteTraining(training.id)}
                                  className="h-6 w-6"
                                  data-testid={`button-delete-training-${index}`}
                                >
                                  <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {trainingComments[training.id] !== undefined && (
                            <tr>
                              <td></td>
                              <td colSpan={3} className="p-2 sm:p-3">
                                <Textarea
                                  value={trainingComments[training.id]}
                                  onChange={(e) => {
                                    setTrainingComments(prev => ({
                                      ...prev,
                                      [training.id]: e.target.value
                                    }));
                                    updateTraining(training.id, "comment", e.target.value);
                                  }}
                                  placeholder="Comment: Add your observations here..."
                                  className="text-blue-600 italic border-blue-200 text-xs sm:text-sm"
                                  rows={2}
                                  data-testid={`textarea-training-comment-${index}`}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {trainings.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-500">
                            No trainings added yet. Click "Add Training" to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {isConfigMode && !sectionVisibility.partB1 && (
            <div className="opacity-50 bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-400">B1. Trainings conducted prior joining vessel (Hidden)</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSectionVisibility('partB1')}
                  className="text-sm px-3 py-1 h-7"
                  style={{ borderColor: '#52baf3', color: '#52baf3' }}
                  data-testid="button-show-b1"
                >
                  Show Section
                </Button>
              </div>
              <div className="text-gray-400 text-sm">Section is hidden</div>
            </div>
          )}

          {sectionVisibility.partB2 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>B2. Target Setting</h3>
                <div className="flex items-center gap-2">
                  {isConfigMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSectionVisibility('partB2')}
                      className="text-sm px-3 py-1 h-7"
                      style={{ borderColor: '#52baf3', color: '#52baf3' }}
                      data-testid="button-toggle-b2"
                    >
                      {sectionVisibility.partB2 ? 'Hide Section' : 'Show Section'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={addTarget}
                    variant="outline"
                    size="sm"
                    className="text-gray-600 border-gray-300"
                    data-testid="button-add-target"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Target
                  </Button>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Setting</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {targets.map((target, index) => (
                      <React.Fragment key={target.id}>
                        <tr className="border-b border-gray-200 bg-white hover:bg-gray-50">
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Input
                              value={target.targetSetting}
                              onChange={(e) => updateTarget(target.id, "targetSetting", e.target.value)}
                              placeholder={`Target ${index + 1}`}
                              className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                              data-testid={`input-target-${index}`}
                            />
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Select
                              value={target.evaluation}
                              onValueChange={(value) => updateTarget(target.id, "evaluation", value)}
                              onOpenChange={(open) => {
                                if (isConfigMode && open && index === 0) {
                                  setShowEffectivenessDialog(true);
                                }
                              }}
                            >
                              <SelectTrigger 
                                className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                                style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                                data-testid={`select-target-eval-${index}`}
                              >
                                <SelectValue placeholder="Select Rating" />
                              </SelectTrigger>
                              <SelectContent>
                                {effectivenessOptions.map((option, optionIndex) => (
                                  <SelectItem key={optionIndex} value={option.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <div className="flex gap-2 justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setTargetComments(prev => ({
                                  ...prev,
                                  [target.id]: prev[target.id] || ""
                                }))}
                                className="h-6 w-6"
                                data-testid={`button-target-comment-${index}`}
                              >
                                <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTarget(target.id)}
                                className="h-6 w-6"
                                data-testid={`button-delete-target-${index}`}
                              >
                                <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {targetComments[target.id] !== undefined && (
                          <tr key={`comment-${target.id}`}>
                            <td></td>
                            <td colSpan={3} className="p-3">
                              <Textarea
                                value={targetComments[target.id]}
                                onChange={(e) => {
                                  setTargetComments(prev => ({
                                    ...prev,
                                    [target.id]: e.target.value
                                  }));
                                  updateTarget(target.id, "comment", e.target.value);
                                }}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200"
                                rows={2}
                                data-testid={`textarea-target-comment-${index}`}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {targets.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">
                          No targets added yet. Click "Add Target" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isConfigMode && !sectionVisibility.partB2 && (
            <div className="opacity-50 bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-400">B2. Target Setting (Hidden)</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSectionVisibility('partB2')}
                  className="text-sm px-3 py-1 h-7"
                  style={{ borderColor: '#52baf3', color: '#52baf3' }}
                  data-testid="button-show-b2"
                >
                  Show Section
                </Button>
              </div>
              <div className="text-gray-400 text-sm">Section is hidden</div>
            </div>
          )}
        </>
      )}

      {isConfigMode && !sectionVisibility.partB && (
        <div className="opacity-50 bg-gray-50 p-6 rounded border-2 border-dashed border-gray-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-400">Part B: Information at Start of Appraisal Period (Hidden)</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partB')}
              className="text-sm px-3 py-1 h-7"
              style={{ borderColor: '#52baf3', color: '#52baf3' }}
              data-testid="button-show-part-b"
            >
              Show Section
            </Button>
          </div>
          <div className="text-gray-400 text-sm">Section is hidden</div>
        </div>
      )}
    </div>
  );
};

export const PartB = React.memo(PartBComponent);
