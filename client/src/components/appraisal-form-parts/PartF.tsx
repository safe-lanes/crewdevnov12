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
import { Plus, MessageSquare, Trash2 } from "lucide-react";
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
  addSeafarerComment,
  updateSeafarerComment,
  deleteSeafarerComment,
  competenceSectionScore,
  behaviouralSectionScore,
  overallScore,
  getScoreColors,
  availableRanks,
  handleStageSubmission,
  stage1Mutation,
  stage2Mutation,
  saveAppraisalMutation,
}) => {
  const deleteRecommendationComment = (id: string) => {
    setRecommendationComments(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const overallScoreValue = parseFloat(overallScore) || 0;
  const { bgColor: overallBgColor, textColor: overallTextColor } = getScoreColors(overallScoreValue);

  return (
    <div ref={partRef} data-section-id="F">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part F: Summary & Recommendations</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Complete the recommendations and provide comments</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>

          <div className="space-y-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-4" style={{ color: '#16569e' }}>Overall Score Summary</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-1">Competence Score</div>
                  <div className={`inline-block px-3 py-1 rounded-full font-semibold ${getScoreColors(parseFloat(competenceSectionScore) || 0).bgColor} ${getScoreColors(parseFloat(competenceSectionScore) || 0).textColor}`}>
                    {competenceSectionScore}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-1">Behavioural Score</div>
                  <div className={`inline-block px-3 py-1 rounded-full font-semibold ${getScoreColors(parseFloat(behaviouralSectionScore) || 0).bgColor} ${getScoreColors(parseFloat(behaviouralSectionScore) || 0).textColor}`}>
                    {behaviouralSectionScore}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-1">Overall Score</div>
                  <div className={`inline-block px-3 py-1 rounded-full font-semibold ${overallBgColor} ${overallTextColor}`}>
                    {overallScore}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-4" style={{ color: '#16569e' }}>Recommendations</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Question</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Answer</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.watch("recommendations").map((rec, index) => (
                      <Fragment key={rec.id}>
                        <tr className="border-t">
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{rec.question}</td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Select value={rec.answer} onValueChange={(value) => updateRecommendation(rec.id, "answer", value)}>
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Yes">Yes</SelectItem>
                                <SelectItem value="No">No</SelectItem>
                                <SelectItem value="NA">N/A</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRecommendationComments(prev => ({ ...prev, [rec.id]: prev[rec.id] || "" }))}>
                              <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                            </Button>
                          </td>
                        </tr>
                        {recommendationComments[rec.id] !== undefined && (
                          <tr>
                            <td></td>
                            <td colSpan={3} className="p-3">
                              {editingRecommendationComment === rec.id ? (
                                <Textarea
                                  value={recommendationComments[rec.id]}
                                  onChange={(e) => { setRecommendationComments(prev => ({ ...prev, [rec.id]: e.target.value })); updateRecommendation(rec.id, "comment", e.target.value); }}
                                  onBlur={() => setEditingRecommendationComment(null)}
                                  placeholder="Comment: Add your observations here..."
                                  className="text-blue-600 italic border-blue-200"
                                  rows={2}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]" onClick={() => setEditingRecommendationComment(rec.id)}>
                                    {recommendationComments[rec.id] || "Click to add comment..."}
                                  </div>
                                  <div className="ml-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteRecommendationComment(rec.id)}>
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

            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium" style={{ color: '#16569e' }}>Appraiser Comments</h4>
                <Button type="button" onClick={addAppraiserComment} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Appraiser
                </Button>
              </div>
              <div className="space-y-4">
                {form.watch("appraiserComments").map((comment, index) => (
                  <div key={comment.id} className="border rounded-lg p-4">
                    <div className="flex gap-4 mb-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Name</label>
                        <Input value={comment.name} onChange={(e) => updateAppraiserComment(comment.id, "name", e.target.value)} placeholder="Appraiser name" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Rank</label>
                        <Select value={comment.rank} onValueChange={(value) => updateAppraiserComment(comment.id, "rank", value)}>
                          <SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger>
                          <SelectContent>
                            {availableRanks.map((rank) => (
                              <SelectItem key={rank.id} value={rank.name}>{rank.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => deleteAppraiserComment(comment.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea value={comment.comment} onChange={(e) => updateAppraiserComment(comment.id, "comment", e.target.value)} placeholder="Enter appraiser comments..." rows={3} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium" style={{ color: '#16569e' }}>Seafarer Comments</h4>
                <Button type="button" onClick={addSeafarerComment} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Comment
                </Button>
              </div>
              <div className="space-y-4">
                {form.watch("seafarerComments").map((comment, index) => (
                  <div key={comment.id} className="border rounded-lg p-4">
                    <div className="flex gap-4 mb-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Name</label>
                        <Input value={comment.name} onChange={(e) => updateSeafarerComment(comment.id, "name", e.target.value)} placeholder="Seafarer name" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Rank</label>
                        <Select value={comment.rank} onValueChange={(value) => updateSeafarerComment(comment.id, "rank", value)}>
                          <SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger>
                          <SelectContent>
                            {availableRanks.map((rank) => (
                              <SelectItem key={rank.id} value={rank.name}>{rank.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => deleteSeafarerComment(comment.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea value={comment.comment} onChange={(e) => updateSeafarerComment(comment.id, "comment", e.target.value)} placeholder="Enter seafarer comments..." rows={3} />
                  </div>
                ))}
              </div>
            </div>

            {appraisalStatus === 'preliminary' && (
              <div className="flex justify-end gap-4 mt-6">
                <Button className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8" onClick={() => handleStageSubmission('stage2')} disabled={stage2Mutation.isPending || saveAppraisalMutation.isPending}>
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
