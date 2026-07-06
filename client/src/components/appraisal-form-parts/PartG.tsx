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
import { DbTrainingCombobox } from "@/components/training/DbTrainingCombobox";
import { useCompanyTrainings } from "@/hooks/useCompanyTrainings";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useTrainingStatusOptionsV2, withLegacyStatus } from "@/hooks/v2/useMasterDataV2";

const PartGComponent: React.FC<PartGProps> = ({
  form,
  partRef,
  appraisalStatus,
  showConfirmDialog,
  trainingFollowupComments,
  setTrainingFollowupComments,
  editingTrainingFollowupComment,
  setEditingTrainingFollowupComment,
  editingOfficeReview,
  setEditingOfficeReview,
  isTrainingFollowupDialogOpen,
  setIsTrainingFollowupDialogOpen,
  addOfficeReview,
  updateOfficeReview,
  deleteOfficeReview,
  addTrainingFollowup,
  updateTrainingFollowup,
  deleteTrainingFollowup,
  handleStageSubmission,
  handleSaveDraft,
  stage3Mutation,
  saveAppraisalMutation,
  isLockForm,
  isPostStage1,
  isPostStage2,
  isPostStage3,
}) => {
  const { options: dbTrainings, isLoading: isLoadingDbTrainings, isError: isErrorDbTrainings } = useCompanyTrainings();
  const { statuses: statusOptions } = useTrainingStatusOptionsV2("Appraisal");
  const { userType } = usePermissions();
  const isShipUser = userType === 'Ship';
  // Task #500: post-Stage 3 fully locks G (legacy behavior).
  const isG1Locked = appraisalStatus === 'reviewed' || appraisalStatus === ('stage3_submitted' as typeof appraisalStatus);

  const deleteTrainingFollowupComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setTrainingFollowupComments(prev => ({ ...prev, [id]: null }));
        setEditingTrainingFollowupComment(null);
      }
    );
  };

  // Task #500: G is fully locked once Stage 3 has been submitted. Using a
  // fieldset disables every native input, select, textarea and button inside,
  // including the Save Draft / Submit Stage 3 actions at the bottom.
  const lockSection = !!isPostStage3 || isShipUser;
  return (
    <fieldset disabled={lockSection} className="min-w-0 border-0 p-0 m-0" data-testid="fieldset-part-g-lock">
    {isShipUser && (
      <div
        className="mb-4 rounded-md border border-gray-300 bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-600"
        data-testid="text-office-use-only-g"
      >
        For Office use only
      </div>
    )}
    <div className={isShipUser ? 'opacity-60 pointer-events-none' : undefined}>
    <div ref={partRef} data-section-id="G">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part G: Office Review & Followup</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Complete office review and training followup actions</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>

          <div className="space-y-8">
            {/* G1. Office Reviews */}
            <div className="border border-[#EAEBEF] rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-base font-medium" style={{ color: '#16569e' }}>G1. Office Reviews</h4>
                <Button type="button" onClick={addOfficeReview} variant="outline" size="sm" disabled={isG1Locked} data-testid="button-add-reviewer">
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
                        {isG1Locked ? (
                          <Input value={review.name} readOnly disabled className="bg-gray-100" data-testid={`input-reviewer-name-${review.id}`} />
                        ) : (
                          <Input value={review.name} onChange={(e) => updateOfficeReview(review.id, "name", e.target.value)} placeholder="Enter name" data-testid={`input-reviewer-name-${review.id}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Position</label>
                        {isG1Locked ? (
                          <Input value={review.position} readOnly disabled className="bg-gray-100" data-testid={`input-reviewer-position-${review.id}`} />
                        ) : (
                          <Input value={review.position} onChange={(e) => updateOfficeReview(review.id, "position", e.target.value)} placeholder="Enter position" data-testid={`input-reviewer-position-${review.id}`} />
                        )}
                      </div>
                      {!isG1Locked && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => deleteOfficeReview(review.id)} data-testid={`button-delete-reviewer-${review.id}`}>
                          <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
                        </Button>
                      )}
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

            {/* G2. Training Followup */}
            <div className="border border-[#EAEBEF] rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-base font-medium" style={{ color: '#16569e' }}>G2. Training Followup</h4>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsTrainingFollowupDialogOpen(true)}
                    data-testid="button-add-training-from-database-g2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Training from Database
                  </Button>
                  <Button 
                    type="button" 
                    onClick={addTrainingFollowup} 
                    variant="outline" 
                    size="sm"
                    data-testid="button-add-new-training-g2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add New Training
                  </Button>
                </div>
              </div>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left w-12">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Corresponding in DB</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Category</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Status</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target or Compl. Date</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.watch("trainingFollowups").map((followup, index) => (
                      <Fragment key={followup.id}>
                        <tr className="border-t border-gray-100">
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            {(() => {
                              const matchedDbOption = dbTrainings.find(o => o.id === followup.correspondingInDB);
                              const isFromDb = (followup as any).addedFromDB === true || (!!followup.correspondingInDB && matchedDbOption?.name === followup.training);
                              return isFromDb ? (
                                <span data-testid={`text-followup-training-${followup.id}`} className="text-[#4f5863] text-[13px] font-normal">
                                  {followup.training}
                                </span>
                              ) : (
                                <Input value={followup.training} onChange={(e) => updateTrainingFollowup(followup.id, "training", e.target.value)} placeholder="Training name" className="h-8" />
                              );
                            })()}
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            {(() => {
                              const matchedDbOption = dbTrainings.find(o => o.id === followup.correspondingInDB);
                              const isFromDb = (followup as any).addedFromDB === true || (!!followup.correspondingInDB && matchedDbOption?.name === followup.training);
                              return isFromDb ? (
                                <span data-testid={`text-followup-db-${followup.id}`} className="text-[#4f5863] text-[13px] font-normal">
                                  {matchedDbOption?.name || followup.training}
                                </span>
                              ) : (
                                <DbTrainingCombobox
                                  value={followup.correspondingInDB || ""}
                                  options={dbTrainings}
                                  onChange={(value) => updateTrainingFollowup(followup.id, "correspondingInDB", value)}
                                  isLoading={isLoadingDbTrainings}
                                  isError={isErrorDbTrainings}
                                  disabled={lockSection}
                                  fallbackLabel={followup.training}
                                  testId={`select-followup-db-${followup.id}`}
                                />
                              );
                            })()}
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Select value={followup.category || undefined} onValueChange={(value) => updateTrainingFollowup(followup.id, "category", value)} disabled={lockSection}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Select Category" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1. Competence">1. Competence</SelectItem>
                                <SelectItem value="2- Soft Skills">2- Soft Skills</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Select value={followup.status || undefined} onValueChange={(value) => updateTrainingFollowup(followup.id, "status", value)} disabled={lockSection}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Select Status" /></SelectTrigger>
                              <SelectContent>
                                {withLegacyStatus(statusOptions, followup.status).map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Input type="date" value={followup.targetDate || ""} onChange={(e) => updateTrainingFollowup(followup.id, "targetDate", e.target.value)} className="h-8" placeholder="dd/mm/yyyy" />
                          </td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <div className="flex gap-1 justify-center">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTrainingFollowupComments(prev => ({ ...prev, [followup.id]: prev[followup.id] || "" }))}>
                                <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTrainingFollowup(followup.id)}>
                                <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {followup.id in trainingFollowupComments && trainingFollowupComments[followup.id] !== null && (
                          <tr>
                            <td></td>
                            <td colSpan={6} className="p-3">
                              {editingTrainingFollowupComment === followup.id ? (
                                <Textarea
                                  value={trainingFollowupComments[followup.id] ?? ""}
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
                                    <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteTrainingFollowupComment(followup.id); }}>
                                      <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                        <td colSpan={7} className="p-8 text-center text-gray-500">
                          No training followups added yet. Click "Add New Training" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons - Save Draft and Submit Stage 3 - Always visible like Section B */}
            <div className="flex justify-end gap-4 mt-6">
              <Button 
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white px-8" 
                onClick={() => handleStageSubmission('stage3')} 
                disabled={stage3Mutation.isPending || saveAppraisalMutation.isPending || appraisalStatus === 'reviewed'}
                data-testid="button-submit-stage-3"
              >
                {stage3Mutation.isPending ? 'Submitting...' : 'Submit Stage 3'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
    </fieldset>
  );
};

export const PartG = memo(PartGComponent);
