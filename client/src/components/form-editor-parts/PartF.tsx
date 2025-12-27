import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Edit2, Trash2 } from "lucide-react";
import { PartFProps } from "./types";

const PartFComponent: React.FC<PartFProps> = ({
  formMethods,
  isConfigMode,
  getDynamicSectionLetter,
  recommendations,
  recommendationComments,
  setRecommendationComments,
  editingRecommendations,
  addRecommendation,
  updateRecommendation,
  deleteRecommendation,
  startEditingRecommendation,
  handleRecommendationBlur,
  overallScore,
  getScoreColors,
}) => {
  const scoreColors = getScoreColors(parseFloat(overallScore));

  return (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('F')}: Summary & Recommendations</h3>
        <div style={{ color: '#16569e' }} className="text-sm">Add any recommendations related to following</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F1. Overall Score</h3>
        <div className={`px-4 py-2 rounded text-lg font-bold min-w-[64px] text-center ${scoreColors.bgColor} ${scoreColors.textColor}`} data-testid="text-overall-score">
          {overallScore}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F2. Appraiser's Recommendations</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-sm px-3 py-1 h-7"
            style={{ 
              borderColor: isConfigMode ? '#52baf3' : '#d1d5db',
              color: isConfigMode ? '#52baf3' : '#6b7280'
            }}
            onClick={addRecommendation}
            data-testid="button-add-recommendation"
          >
            + Add Recommendation
          </Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Recommendations</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Yes</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">No</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">NA</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((recommendation, index) => (
                <React.Fragment key={recommendation.id}>
                  <tr className="border-t">
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4" style={{ 
                      color: recommendation.isCustom && isConfigMode ? '#52baf3' : 'inherit'
                    }}>
                      {recommendation.isCustom && isConfigMode ? (
                        editingRecommendations.has(recommendation.id) ? (
                          <Input
                            value={recommendation.question === "Add new recommendation" ? "" : recommendation.question}
                            onChange={(e) => updateRecommendation(recommendation.id, "question", e.target.value)}
                            onBlur={() => handleRecommendationBlur(recommendation.id)}
                            placeholder="Add new recommendation"
                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6"
                            style={{ color: '#52baf3' }}
                            autoFocus
                            data-testid={`input-recommendation-${index}`}
                          />
                        ) : (
                          <div
                            className="cursor-pointer p-0 text-[13px]"
                            onClick={() => startEditingRecommendation(recommendation.id)}
                            style={{ color: '#52baf3' }}
                            data-testid={`text-recommendation-${index}`}
                          >
                            {recommendation.question}
                          </div>
                        )
                      ) : (
                        <span className="text-[13px]">{recommendation.question}</span>
                      )}
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                      <input
                        type="radio"
                        name={`recommendation-${recommendation.id}`}
                        checked={recommendation.answer === "Yes"}
                        onChange={() => updateRecommendation(recommendation.id, "answer", "Yes")}
                        className="w-4 h-4"
                        data-testid={`radio-recommendation-yes-${index}`}
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                      <input
                        type="radio"
                        name={`recommendation-${recommendation.id}`}
                        checked={recommendation.answer === "No"}
                        onChange={() => updateRecommendation(recommendation.id, "answer", "No")}
                        className="w-4 h-4"
                        data-testid={`radio-recommendation-no-${index}`}
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                      <input
                        type="radio"
                        name={`recommendation-${recommendation.id}`}
                        checked={recommendation.answer === "NA"}
                        onChange={() => updateRecommendation(recommendation.id, "answer", "NA")}
                        className="w-4 h-4"
                        data-testid={`radio-recommendation-na-${index}`}
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <div className="flex justify-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setRecommendationComments(prev => ({
                            ...prev,
                            [recommendation.id]: prev[recommendation.id] || ""
                          }))}
                          className="h-6 w-6"
                          data-testid={`button-recommendation-comment-${index}`}
                        >
                          <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                        </Button>
                        {recommendation.isCustom && isConfigMode && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              style={{ color: '#52baf3' }}
                              onClick={() => startEditingRecommendation(recommendation.id)}
                              className="h-6 w-6"
                              data-testid={`button-edit-recommendation-${index}`}
                            >
                              <Edit2 className="h-[18px] w-[18px]" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRecommendation(recommendation.id)}
                              style={{ color: '#52baf3' }}
                              className="h-6 w-6"
                              data-testid={`button-delete-recommendation-${index}`}
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {recommendationComments[recommendation.id] !== undefined && (
                    <tr key={`comment-${recommendation.id}`}>
                      <td></td>
                      <td colSpan={5} className="p-3">
                        <Textarea
                          value={recommendationComments[recommendation.id]}
                          onChange={(e) => {
                            setRecommendationComments(prev => ({
                              ...prev,
                              [recommendation.id]: e.target.value
                            }));
                            updateRecommendation(recommendation.id, "comment", e.target.value);
                          }}
                          placeholder="Comment: Add your observations here..."
                          className="text-blue-600 italic border-blue-200"
                          rows={2}
                          data-testid={`textarea-recommendation-comment-${index}`}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F3. Appraiser Comments</h3>
        <div className="space-y-2">
          <Label htmlFor="appraiserComments">Appraiser Comments</Label>
          <Textarea
            id="appraiserComments"
            placeholder="Add appraiser comments..."
            {...formMethods.register("appraiserComments")}
            rows={4}
            data-testid="textarea-appraiser-comments"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F4. Seafarer Comments</h3>
        <div className="space-y-2">
          <Label htmlFor="seafarerComments">Seafarer Comments</Label>
          <Textarea
            id="seafarerComments"
            placeholder="Add seafarer comments..."
            {...formMethods.register("seafarerComments")}
            rows={4}
            data-testid="textarea-seafarer-comments"
          />
        </div>
      </div>
    </div>
  );
};

export const PartF = React.memo(PartFComponent);
