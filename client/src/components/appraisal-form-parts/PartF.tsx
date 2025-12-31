import { memo, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, MessageSquare } from "lucide-react";
import { PartFProps } from "./types";

const PartFComponent: React.FC<PartFProps> = ({
  form,
  partRef,
  appraisalStatus,
  recommendationComments,
  setRecommendationComments,
  editingRecommendationComment,
  setEditingRecommendationComment,
  editingAppraiserComment,
  setEditingAppraiserComment,
  editingSeafarerComment,
  setEditingSeafarerComment,
  updateRecommendation,
  addAppraiserComment,
  updateAppraiserComment,
  deleteAppraiserComment,
  updateSeafarerComment,
  competenceSectionScore,
  behaviouralSectionScore,
  overallScore,
  getScoreColors,
  availableRanks,
  handleStageSubmission,
  stage1Mutation,
  stage2Mutation,
  saveAppraisalMutation,
  handleSaveDraft,
}) => {
  const overallScoreValue = parseFloat(overallScore) || 0;
  const { bgColor: overallBgColor, textColor: overallTextColor } = getScoreColors(overallScoreValue);

  // Map primaryAppraiser value to rank name
  const primaryAppraiserToRank: Record<string, string> = {
    "master": "Master",
    "chief-officer": "Chief Officer",
    "chief-engineer": "Chief Engineer",
    "2nd-engineer": "2nd Engineer",
    "marine-superintendent": "Marine Superintendent",
    "technical-superintendent": "Technical Superintendent",
    "crew-manager": "Crew Manager",
  };

  // Get the primary appraiser rank from Part A selection
  const primaryAppraiserValue = form.watch("primaryAppraiser");
  const primaryAppraiserRank = primaryAppraiserToRank[primaryAppraiserValue || ""] || "";

  return (
    <div ref={partRef} data-section-id="F">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part F Comments & Recommendations</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Add any recommendations related to following</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>

          <div className="space-y-8">
            {/* F1. Overall Score */}
            <div className="border border-[#EAEBEF] rounded-lg p-4">
              <h4 className="text-base font-medium mb-4" style={{ color: '#16569e' }}>F1. Overall Score</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Competence Score</div>
                  <div className={`inline-block px-4 py-2 rounded-full font-semibold text-lg ${getScoreColors(parseFloat(competenceSectionScore) || 0).bgColor} ${getScoreColors(parseFloat(competenceSectionScore) || 0).textColor}`}>
                    {competenceSectionScore}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Behavioural Score</div>
                  <div className={`inline-block px-4 py-2 rounded-full font-semibold text-lg ${getScoreColors(parseFloat(behaviouralSectionScore) || 0).bgColor} ${getScoreColors(parseFloat(behaviouralSectionScore) || 0).textColor}`}>
                    {behaviouralSectionScore}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">Overall Score</div>
                  <div className={`inline-block px-4 py-2 rounded-full font-semibold text-lg ${overallBgColor} ${overallTextColor}`}>
                    {overallScore}
                  </div>
                </div>
              </div>
            </div>

            {/* F2. Appraiser's Recommendations */}
            <div className="border border-[#EAEBEF] rounded-lg p-4">
              <h4 className="text-base font-medium mb-4" style={{ color: '#16569e' }}>F2. Appraiser's Recommendations</h4>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left w-12">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Recommendations</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 text-center w-16">Yes</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 text-center w-16">No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-2 text-center w-16">NA</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.watch("recommendations").map((rec, index) => (
                      <Fragment key={rec.id}>
                        <tr className="border-t border-gray-100">
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{rec.question}</td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="radio"
                              name={`recommendation-${rec.id}`}
                              checked={rec.answer === "Yes"}
                              onChange={() => updateRecommendation(rec.id, "answer", "Yes")}
                              className="w-4 h-4 text-blue-600 cursor-pointer"
                              data-testid={`radio-recommendation-yes-${rec.id}`}
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="radio"
                              name={`recommendation-${rec.id}`}
                              checked={rec.answer === "No"}
                              onChange={() => updateRecommendation(rec.id, "answer", "No")}
                              className="w-4 h-4 text-blue-600 cursor-pointer"
                              data-testid={`radio-recommendation-no-${rec.id}`}
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="radio"
                              name={`recommendation-${rec.id}`}
                              checked={rec.answer === "NA"}
                              onChange={() => updateRecommendation(rec.id, "answer", "NA")}
                              className="w-4 h-4 text-blue-600 cursor-pointer"
                              data-testid={`radio-recommendation-na-${rec.id}`}
                            />
                          </td>
                          <td className="py-2 px-4 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setRecommendationComments(prev => ({ ...prev, [rec.id]: prev[rec.id] ?? rec.comment ?? "" }))}
                              data-testid={`button-recommendation-comment-${rec.id}`}
                            >
                              <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                            </Button>
                          </td>
                        </tr>
                        {recommendationComments[rec.id] !== undefined && (
                          <tr>
                            <td></td>
                            <td colSpan={5} className="p-3">
                              {editingRecommendationComment === rec.id ? (
                                <Textarea
                                  value={recommendationComments[rec.id]}
                                  onChange={(e) => {
                                    setRecommendationComments(prev => ({ ...prev, [rec.id]: e.target.value }));
                                    updateRecommendation(rec.id, "comment", e.target.value);
                                  }}
                                  onBlur={() => setEditingRecommendationComment(null)}
                                  placeholder="Comment: Add your observations here..."
                                  className="text-blue-600 italic border-blue-200"
                                  rows={2}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex justify-between items-start">
                                  <div
                                    className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]"
                                    onClick={() => setEditingRecommendationComment(rec.id)}
                                  >
                                    {recommendationComments[rec.id] || "Click to add comment..."}
                                  </div>
                                  <div className="ml-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setRecommendationComments(prev => {
                                          const newComments = { ...prev };
                                          delete newComments[rec.id];
                                          return newComments;
                                        });
                                        updateRecommendation(rec.id, "comment", "");
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* F3. Appraiser Comments - Styled like Promotion Review A4 */}
            <div className="border border-[#EAEBEF] rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-base font-medium" style={{ color: '#16569e' }}>F3. Appraiser Comments</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={addAppraiserComment}
                  data-testid="button-add-appraiser"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Appraiser
                </Button>
              </div>

              <div className="space-y-3">
                {form.watch("appraiserComments").map((comment, index) => {
                  const isPrimary = index === 0;
                  const isEditing = editingAppraiserComment === comment.id || (!comment.name && !comment.comment);
                  // Auto-fill primary appraiser's rank from Part A selection
                  const displayRank = isPrimary && !comment.rank && primaryAppraiserRank 
                    ? primaryAppraiserRank 
                    : comment.rank;
                  return (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded" data-testid={`appraiser-comment-${comment.id}`}>
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <Input
                                value={comment.name}
                                onChange={(e) => updateAppraiserComment(comment.id, "name", e.target.value)}
                                placeholder="Appraiser name"
                                className="text-sm"
                                data-testid={`input-appraiser-name-${comment.id}`}
                              />
                            </div>
                            <div className="flex-1">
                              <Select
                                value={isPrimary && !comment.rank && primaryAppraiserRank ? primaryAppraiserRank : comment.rank}
                                onValueChange={(value) => updateAppraiserComment(comment.id, "rank", value)}
                              >
                                <SelectTrigger data-testid={`select-appraiser-rank-${comment.id}`}>
                                  <SelectValue placeholder="Select rank" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableRanks.map((rank) => (
                                    <SelectItem key={rank.id} value={rank.name}>{rank.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {!isPrimary && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => deleteAppraiserComment(comment.id)}
                                data-testid={`button-delete-appraiser-${comment.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-gray-400" />
                              </Button>
                            )}
                          </div>
                          <Textarea
                            value={comment.comment}
                            onChange={(e) => updateAppraiserComment(comment.id, "comment", e.target.value)}
                            onBlur={() => setEditingAppraiserComment(null)}
                            placeholder="Enter appraiser comments..."
                            rows={2}
                            className="text-sm"
                            data-testid={`textarea-appraiser-comment-${comment.id}`}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium" data-testid={`text-appraiser-name-${comment.id}`}>
                              {comment.name}{displayRank ? `, ${displayRank}` : ""}
                              {!comment.name && isPrimary && " (Primary Appraiser)"}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setEditingAppraiserComment(comment.id)}
                                data-testid={`button-edit-appraiser-${comment.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-400" />
                              </Button>
                              {!isPrimary && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => deleteAppraiserComment(comment.id)}
                                  data-testid={`button-delete-appraiser-${comment.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p
                            className="text-sm text-gray-600 italic cursor-pointer"
                            onClick={() => setEditingAppraiserComment(comment.id)}
                            data-testid={`text-appraiser-comment-${comment.id}`}
                          >
                            {comment.comment || "Click to add comment..."}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* F4. Seafarer Comments - Single fixed comment box with pre-filled name/rank */}
            <div className="border border-[#EAEBEF] rounded-lg p-4">
              <h4 className="text-base font-medium mb-4" style={{ color: '#16569e' }}>F4. Seafarer Comments</h4>

              <div className="space-y-3">
                {form.watch("seafarerComments").map((comment) => {
                  // Use seafarer's name and rank from Part A (pre-filled and non-editable)
                  const seafarerName = form.watch("seafarersName") || comment.name || "";
                  const seafarerRank = form.watch("seafarersRank") || comment.rank || "";
                  const isEditing = editingSeafarerComment === comment.id;
                  return (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded" data-testid={`seafarer-comment-${comment.id}`}>
                      {/* Seafarer name and rank - pre-filled and non-editable */}
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-medium" data-testid={`text-seafarer-name-${comment.id}`}>
                          {seafarerName}{seafarerRank ? `, ${seafarerRank}` : ""}
                        </span>
                        {!isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setEditingSeafarerComment(comment.id)}
                            data-testid={`button-edit-seafarer-${comment.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                        )}
                      </div>
                      {/* Comment textarea - editable */}
                      {isEditing ? (
                        <Textarea
                          value={comment.comment}
                          onChange={(e) => updateSeafarerComment(comment.id, "comment", e.target.value)}
                          onBlur={() => setEditingSeafarerComment(null)}
                          placeholder="Enter seafarer comments..."
                          rows={3}
                          className="text-sm"
                          autoFocus
                          data-testid={`textarea-seafarer-comment-${comment.id}`}
                        />
                      ) : (
                        <p
                          className="text-sm text-gray-600 italic cursor-pointer"
                          onClick={() => setEditingSeafarerComment(comment.id)}
                          data-testid={`text-seafarer-comment-${comment.id}`}
                        >
                          {comment.comment || "Click to add comment..."}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons - Save Draft and Submit Stage 2 */}
            {(appraisalStatus === 'draft' || appraisalStatus === 'preliminary') && (
              <div className="flex justify-end gap-4 mt-6">
                <Button
                  type="button"
                  className="bg-[#5fa5fa] hover:bg-[#4a94e8] text-white px-8"
                  onClick={handleSaveDraft}
                  disabled={saveAppraisalMutation.isPending}
                  data-testid="button-save-draft-part-f"
                >
                  {saveAppraisalMutation.isPending ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  type="button"
                  className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8"
                  onClick={() => handleStageSubmission('stage2')}
                  disabled={stage2Mutation.isPending || saveAppraisalMutation.isPending}
                  data-testid="button-submit-stage-2"
                >
                  {stage2Mutation.isPending ? 'Submitting...' : 'Submit Stage 2'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const PartF = memo(PartFComponent);
