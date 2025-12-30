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
import { PartGProps } from "./types";

const PartGComponent: React.FC<PartGProps> = ({
  form,
  partRef,
  appraisalStatus,
  trainingFollowupComments,
  setTrainingFollowupComments,
  editingTrainingFollowupComment,
  setEditingTrainingFollowupComment,
  editingOfficeReview,
  setEditingOfficeReview,
  addOfficeReview,
  updateOfficeReview,
  deleteOfficeReview,
  addTrainingFollowup,
  updateTrainingFollowup,
  deleteTrainingFollowup,
  handleStageSubmission,
  stage3Mutation,
  saveAppraisalMutation,
}) => {
  const deleteTrainingFollowupComment = (id: string) => {
    setTrainingFollowupComments(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div ref={partRef} data-section-id="G">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part G: Office Review & Followup</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Complete office review and training followup actions</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium" style={{ color: '#16569e' }}>Office Reviews</h4>
                <Button type="button" onClick={addOfficeReview} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Reviewer
                </Button>
              </div>
              <div className="space-y-4">
                {form.watch("officeReviews").map((review, index) => (
                  <div key={review.id} className="border rounded-lg p-4">
                    <div className="flex gap-4 mb-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Reviewer Name</label>
                        <Input value={review.name} onChange={(e) => updateOfficeReview(review.id, "name", e.target.value)} placeholder="Enter name" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Position</label>
                        <Input value={review.position} onChange={(e) => updateOfficeReview(review.id, "position", e.target.value)} placeholder="Enter position" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => deleteOfficeReview(review.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea value={review.feedback} onChange={(e) => updateOfficeReview(review.id, "feedback", e.target.value)} placeholder="Enter feedback..." rows={3} />
                  </div>
                ))}
                {form.watch("officeReviews").length === 0 && (
                  <div className="text-center text-gray-500 py-8 border rounded-lg">
                    No office reviews added yet. Click "Add Reviewer" to get started.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium" style={{ color: '#16569e' }}>Training Followups</h4>
                <Button type="button" onClick={addTrainingFollowup} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Training Followup
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Category</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Status</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Date</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.watch("trainingFollowups").map((followup, index) => (
                      <Fragment key={followup.id}>
                        <tr className="border-t">
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Input value={followup.training} onChange={(e) => updateTrainingFollowup(followup.id, "training", e.target.value)} placeholder="Training name" className="border-0 bg-transparent p-0 h-6" />
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Select value={followup.category} onValueChange={(value) => updateTrainingFollowup(followup.id, "category", value)}>
                              <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Category" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Statutory">Statutory</SelectItem>
                                <SelectItem value="Non-Statutory">Non-Statutory</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Select value={followup.status} onValueChange={(value) => updateTrainingFollowup(followup.id, "status", value)}>
                              <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Proposed">Proposed</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Planned">Planned</SelectItem>
                                <SelectItem value="Declined">Declined</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Input type="date" value={followup.targetDate || ""} onChange={(e) => updateTrainingFollowup(followup.id, "targetDate", e.target.value)} className="h-8 w-32" />
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <div className="flex gap-2 justify-center">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTrainingFollowupComments(prev => ({ ...prev, [followup.id]: prev[followup.id] || "" }))}>
                                <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTrainingFollowup(followup.id)}>
                                <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {trainingFollowupComments[followup.id] !== undefined && (
                          <tr>
                            <td></td>
                            <td colSpan={5} className="p-3">
                              {editingTrainingFollowupComment === followup.id ? (
                                <Textarea
                                  value={trainingFollowupComments[followup.id]}
                                  onChange={(e) => { setTrainingFollowupComments(prev => ({ ...prev, [followup.id]: e.target.value })); updateTrainingFollowup(followup.id, "comment", e.target.value); }}
                                  onBlur={() => setEditingTrainingFollowupComment(null)}
                                  placeholder="Comment: Add your observations here..."
                                  className="text-blue-600 italic border-blue-200"
                                  rows={2}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]" onClick={() => setEditingTrainingFollowupComment(followup.id)}>
                                    {trainingFollowupComments[followup.id] || "Click to add comment..."}
                                  </div>
                                  <div className="ml-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteTrainingFollowupComment(followup.id)}>
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
                    {form.watch("trainingFollowups").length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          No training followups added yet. Click "Add Training Followup" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {appraisalStatus === 'submitted' && (
              <div className="flex justify-end gap-4 mt-6">
                <Button className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8" onClick={() => handleStageSubmission('stage3')} disabled={stage3Mutation.isPending || saveAppraisalMutation.isPending}>
                  {stage3Mutation.isPending ? 'Submitting...' : 'Submit Stage 3'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const PartG = memo(PartGComponent);
