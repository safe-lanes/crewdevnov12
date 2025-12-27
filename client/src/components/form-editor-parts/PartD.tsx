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
import { PartDProps } from "./types";

const PartDComponent: React.FC<PartDProps> = ({
  formMethods,
  isConfigMode,
  sectionVisibility,
  toggleSectionVisibility,
  effectivenessOptions,
  getDynamicSectionLetter,
  behaviouralAssessments,
  behaviouralComments,
  setBehaviouralComments,
  addBehaviouralAssessment,
  updateBehaviouralAssessment,
  deleteBehaviouralAssessment,
  sectionScore,
  getScoreColors,
  setShowEffectivenessDialog,
}) => {
  const scoreColors = getScoreColors(parseFloat(sectionScore));

  return (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('D')}: Behavioural Assessment (Soft Skills)</h3>
          {isConfigMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partD')}
              className="text-sm px-3 py-1 h-7"
              style={{ borderColor: '#52baf3', color: '#52baf3' }}
              data-testid="button-toggle-part-d"
            >
              {sectionVisibility.partD ? 'Hide Section' : 'Show Section'}
            </Button>
          )}
        </div>
        <div style={{ color: '#16569e' }} className="text-sm">Select the most appropriate rating basis assessment of the specific criterion</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      {sectionVisibility.partD && (
        <>
          {isConfigMode && (
            <div className="flex justify-end items-center mb-4">
              <Button
                type="button"
                onClick={addBehaviouralAssessment}
                variant="outline"
                size="sm"
                className="text-sm px-3 py-1 h-7"
                style={{ borderColor: '#52baf3', color: '#52baf3' }}
                data-testid="button-add-behavioural-criterion"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Criterion
              </Button>
            </div>
          )}
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Assessment Criteria</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Weight %</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Effectiveness</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {behaviouralAssessments.map((assessment, index) => (
                  <React.Fragment key={assessment.id}>
                    <tr className="border-t">
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        {isConfigMode ? (
                          <Input
                            value={assessment.assessmentCriteria}
                            onChange={(e) => updateBehaviouralAssessment(assessment.id, "assessmentCriteria", e.target.value)}
                            placeholder="Enter Assessment Criteria"
                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6"
                            style={{ color: '#52baf3' }}
                            data-testid={`input-behavioural-criteria-${index}`}
                          />
                        ) : (
                          <span className="text-[13px]">{assessment.assessmentCriteria}</span>
                        )}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                        {isConfigMode ? (
                          <Input
                            type="number"
                            value={assessment.weight}
                            onChange={(e) => updateBehaviouralAssessment(assessment.id, "weight", parseInt(e.target.value) || 0)}
                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-center w-16 text-[13px] h-6"
                            style={{ color: '#52baf3' }}
                            data-testid={`input-behavioural-weight-${index}`}
                          />
                        ) : (
                          <span className="text-[13px]">{assessment.weight}%</span>
                        )}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        <Select
                          value={assessment.effectiveness}
                          onValueChange={(value) => updateBehaviouralAssessment(assessment.id, "effectiveness", value)}
                          onOpenChange={(open) => {
                            if (isConfigMode && open && index === 0) {
                              setShowEffectivenessDialog(true);
                            }
                          }}
                        >
                          <SelectTrigger 
                            className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                            style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                            data-testid={`select-behavioural-effectiveness-${index}`}
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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setBehaviouralComments(prev => ({
                              ...prev,
                              [assessment.id]: prev[assessment.id] || ""
                            }))}
                            className="h-6 w-6"
                            data-testid={`button-behavioural-comment-${index}`}
                          >
                            <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                          {isConfigMode && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteBehaviouralAssessment(assessment.id)}
                              className="text-red-600 hover:text-red-800 h-6 w-6"
                              data-testid={`button-delete-behavioural-${index}`}
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {behaviouralComments[assessment.id] !== undefined && (
                      <tr key={`comment-${assessment.id}`}>
                        <td></td>
                        <td colSpan={4} className="p-3">
                          <Textarea
                            value={behaviouralComments[assessment.id]}
                            onChange={(e) => {
                              setBehaviouralComments(prev => ({
                                ...prev,
                                [assessment.id]: e.target.value
                              }));
                              updateBehaviouralAssessment(assessment.id, "comment", e.target.value);
                            }}
                            placeholder="Comment: Add your observations here..."
                            className="text-blue-600 italic border-blue-200"
                            rows={2}
                            data-testid={`textarea-behavioural-comment-${index}`}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Section Score:</span>
            <div className={`px-4 py-2 rounded text-lg font-semibold min-w-[64px] text-center ${scoreColors.bgColor} ${scoreColors.textColor}`} data-testid="text-behavioural-score">
              {sectionScore}
            </div>
          </div>
        </>
      )}

      {isConfigMode && !sectionVisibility.partD && (
        <div className="opacity-50 bg-gray-50 p-6 rounded border-2 border-dashed border-gray-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-400">Part D: Behavioural Assessment (Soft Skills) (Hidden)</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partD')}
              className="text-sm px-3 py-1 h-7"
              style={{ borderColor: '#52baf3', color: '#52baf3' }}
              data-testid="button-show-part-d"
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

export const PartD = React.memo(PartDComponent);
