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
import { PartCProps } from "./types";

const PartCComponent: React.FC<PartCProps> = ({
  formMethods,
  isConfigMode,
  effectivenessOptions,
  getDynamicSectionLetter,
  competenceAssessments,
  competenceComments,
  setCompetenceComments,
  addCompetenceCriterion,
  updateCompetenceCriterion,
  deleteCompetenceCriterion,
  sectionScore,
  getScoreColors,
  setShowEffectivenessDialog,
}) => {
  const scoreColors = getScoreColors(parseFloat(sectionScore));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="pb-3 sm:pb-4 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('C')}: Competence Assessment (Professional Knowledge & Skills)</h3>
        <div style={{ color: '#16569e' }} className="text-xs sm:text-sm">Select the most appropriate rating basis assessment of the specific criterion</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      {isConfigMode && (
        <div className="flex justify-end items-center mb-4">
          <Button
            type="button"
            onClick={addCompetenceCriterion}
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
            style={{ borderColor: '#52baf3', color: '#52baf3' }}
            data-testid="button-add-competence-criterion"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Add Criterion</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      )}
      
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
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
              {competenceAssessments.map((assessment, index) => (
                <React.Fragment key={assessment.id}>
                  <tr className="border-t">
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      {isConfigMode ? (
                        <Input
                          value={assessment.assessmentCriteria}
                          onChange={(e) => updateCompetenceCriterion(assessment.id, "assessmentCriteria", e.target.value)}
                          placeholder="Enter assessment criteria"
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6"
                          style={{ color: '#52baf3' }}
                          data-testid={`input-competence-criteria-${index}`}
                        />
                      ) : (
                        <span className="text-[13px]">{assessment.assessmentCriteria}</span>
                      )}
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      {isConfigMode ? (
                        <Input
                          type="number"
                          value={assessment.weight}
                          onChange={(e) => updateCompetenceCriterion(assessment.id, "weight", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 w-12 text-[13px] h-6"
                          style={{ color: '#52baf3' }}
                          min="0"
                          max="100"
                          data-testid={`input-competence-weight-${index}`}
                        />
                      ) : (
                        <span className="text-[13px]">{assessment.weight}%</span>
                      )}
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select
                        value={assessment.effectiveness}
                        onValueChange={(value) => updateCompetenceCriterion(assessment.id, "effectiveness", value)}
                        onOpenChange={(open) => {
                          if (isConfigMode && open && index === 0) {
                            setShowEffectivenessDialog(true);
                          }
                        }}
                      >
                        <SelectTrigger 
                          className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                          style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                          data-testid={`select-competence-effectiveness-${index}`}
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
                          onClick={() => setCompetenceComments(prev => ({
                            ...prev,
                            [assessment.id]: prev[assessment.id] || ""
                          }))}
                          className="h-6 w-6"
                          data-testid={`button-competence-comment-${index}`}
                        >
                          <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                        </Button>
                        {isConfigMode && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCompetenceCriterion(assessment.id)}
                            className="h-6 w-6"
                            data-testid={`button-delete-competence-${index}`}
                          >
                            <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {competenceComments[assessment.id] !== undefined && (
                    <tr key={`comment-${assessment.id}`}>
                      <td></td>
                      <td colSpan={4} className="p-2 sm:p-3">
                        <Textarea
                          value={competenceComments[assessment.id]}
                          onChange={(e) => {
                            setCompetenceComments(prev => ({
                              ...prev,
                              [assessment.id]: e.target.value
                            }));
                            updateCompetenceCriterion(assessment.id, "comment", e.target.value);
                          }}
                          placeholder="Comment: Add your observations here..."
                          className="text-blue-600 italic border-blue-200 text-xs sm:text-sm"
                          rows={2}
                          data-testid={`textarea-competence-comment-${index}`}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {competenceAssessments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 sm:p-8 text-center text-gray-500 text-xs sm:text-sm">
                    {isConfigMode ? "No assessment criteria added yet. Click \"Add Criterion\" to get started." : "No assessment criteria configured."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg gap-2 sm:gap-0">
        <div className="text-xs sm:text-sm font-medium text-gray-700">Section Score:</div>
        <div className={`px-3 sm:px-4 py-2 rounded text-base sm:text-lg font-semibold min-w-[48px] sm:min-w-[64px] text-center ${scoreColors.bgColor} ${scoreColors.textColor}`} data-testid="text-competence-score">
          {sectionScore}
        </div>
      </div>
    </div>
  );
};

export const PartC = React.memo(PartCComponent);
