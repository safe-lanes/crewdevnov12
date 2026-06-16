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
import { PartBProps } from "./types";
import { RequiredMark } from "./RequiredMark";

const PartBComponent: React.FC<PartBProps> = ({
  form,
  partRef,
  isSectionVisible,
  showEvaluation,
  showConfirmDialog,
  trainingComments,
  setTrainingComments,
  targetComments,
  setTargetComments,
  editingTrainingComment,
  setEditingTrainingComment,
  editingTargetComment,
  setEditingTargetComment,
  addTraining,
  updateTraining,
  deleteTraining,
  addTarget,
  updateTarget,
  deleteTarget,
  isLockForm,
  isPostStage2,
  isPostStage3,
}) => {
  // Task #500 + #504:
  //   - When the form's lock-form flag is on and Stage 2 has been submitted,
  //     both B1 and B2 stay editable only for the Evaluation column;
  //     everything else (training/target name, delete, add) locks down.
  //   - After Stage 3, everything locks regardless of the flag.
  // Task #513: lock-form flag is the gate for all post-stage locking.
  // When the admin flag is OFF, Stage 2/3 submits no longer freeze B1/B2.
  const lockB1Structural = !!isLockForm && !!(isPostStage2 || isPostStage3);
  const lockB1Evaluation = !!isLockForm && !!isPostStage3;
  const lockB2Structural = !!isLockForm && !!(isPostStage2 || isPostStage3);
  const lockB2Evaluation = !!isLockForm && !!isPostStage3;
  // Backwards-compat alias used by the B2 "Add Target" / delete buttons.
  const lockB2 = lockB2Structural;
  const deleteTrainingComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setTrainingComments(prev => ({ ...prev, [id]: null }));
        setEditingTrainingComment(null);
      }
    );
  };

  const deleteTargetComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setTargetComments(prev => ({ ...prev, [id]: null }));
        setEditingTargetComment(null);
      }
    );
  };

  if (!isSectionVisible('partB')) return null;
  const showB1 = isSectionVisible('partB1');
  const showB2 = isSectionVisible('partB2');
  if (!showB1 && !showB2) return null;

  return (
    <div ref={partRef} data-section-id="B">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part B: Information at Start of Appraisal Period</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Add below at the start of the Appraisal Period except the Evaluation which must be completed at the end of the Appraisal Period</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>
          <div className="space-y-8">
            {showB1 && (
            <div data-testid="section-b1">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-[16px]" style={{ color: '#16569e' }}>B1. Trainings conducted prior joining vessel (To Assess Effectiveness)<RequiredMark /></h3>
                <Button type="button" onClick={addTraining} variant="outline" size="sm" className="text-gray-600 border-gray-300" disabled={lockB1Structural} data-testid="button-add-training">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Training
                </Button>
              </div>
              
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] table-fixed">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left w-[60px]">S.No</th>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                        {showEvaluation && <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left w-[260px]">Evaluation</th>}
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center w-[110px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {form.watch("trainings").map((training, index) => {
                        const isAutoRow = (training as { source?: string }).source === 'auto';
                        // Auto-fetched rows are non-deletable and their training
                        // name is read-only. They also lock once stage-2 lock
                        // kicks in.
                        const lockName = lockB1Structural || isAutoRow;
                        const lockDelete = lockB1Structural || isAutoRow;
                        return (
                        <Fragment key={training.id}>
                          <tr className="border-b border-gray-200 bg-white hover:bg-gray-50" data-testid={`row-training-${training.id}`}>
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <Input
                                value={training.training}
                                onChange={(e) => updateTraining(training.id, "training", e.target.value)}
                                placeholder={`Training ${index + 1}`}
                                readOnly={lockName}
                                disabled={lockName}
                                className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                data-testid={`input-training-name-${training.id}`}
                              />
                            </td>
                            {showEvaluation && (
                              <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                <Select value={training.evaluation} onValueChange={(value) => updateTraining(training.id, "evaluation", value)} disabled={lockB1Evaluation}>
                                  <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6" data-testid={`select-training-eval-${training.id}`}>
                                    <SelectValue placeholder="Select Rating" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="5-exceeded-expectations">5- Exceeded Expectations</SelectItem>
                                    <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                                    <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                                    <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                                    <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                            )}
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <div className="flex gap-2 justify-center">
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={lockB1Structural} onClick={() => setTrainingComments(prev => ({ ...prev, [training.id]: prev[training.id] || "" }))} data-testid={`button-add-training-comment-${training.id}`}>
                                  <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                </Button>
                                {!lockDelete && (
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTraining(training.id)} data-testid={`button-delete-training-${training.id}`}>
                                    <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {training.id in trainingComments && trainingComments[training.id] !== null && (
                            <tr>
                              <td></td>
                              <td colSpan={3} className="p-3">
                                {editingTrainingComment === training.id && !lockB1Structural ? (
                                  <Textarea
                                    value={trainingComments[training.id] ?? ""}
                                    onChange={(e) => { setTrainingComments(prev => ({ ...prev, [training.id]: e.target.value })); updateTraining(training.id, "comment", e.target.value); }}
                                    onBlur={() => setEditingTrainingComment(null)}
                                    placeholder="Comment: Add your observations here..."
                                    className="text-blue-600 italic border-blue-200"
                                    rows={2}
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex justify-between items-start">
                                    <div
                                      className={`flex-1 text-blue-600 italic p-2 rounded text-[13px] ${lockB1Structural ? "" : "cursor-pointer hover:bg-gray-50"}`}
                                      onClick={() => { if (!lockB1Structural) setEditingTrainingComment(training.id); }}
                                    >
                                      {trainingComments[training.id] || "Click to add comment..."}
                                    </div>
                                    {!lockB1Structural && (
                                      <div className="ml-2">
                                        <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteTrainingComment(training.id); }} data-testid={`button-delete-training-comment-${training.id}`}>
                                          <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                        );
                      })}
                      {form.watch("trainings").length === 0 && (
                        <tr>
                          <td colSpan={showEvaluation ? 4 : 3} className="p-8 text-center text-gray-500">
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

            {showB2 && (
            <div data-testid="section-b2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-[16px]" style={{ color: '#16569e' }}>B2. Target Setting<RequiredMark /></h3>
                <Button type="button" onClick={addTarget} variant="outline" size="sm" className="text-gray-600 border-gray-300" disabled={lockB2} data-testid="button-add-target">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Target
                </Button>
              </div>
              
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] table-fixed">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left w-[60px]">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Setting</th>
                      {showEvaluation && <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left w-[260px]">Evaluation</th>}
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center w-[110px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {form.watch("targets").map((target, index) => (
                      <Fragment key={target.id}>
                        <tr className="border-b border-gray-200 bg-white hover:bg-gray-50">
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <Input
                              value={target.targetSetting}
                              onChange={(e) => updateTarget(target.id, "targetSetting", e.target.value)}
                              placeholder={`Target ${index + 1}`}
                              readOnly={lockB2}
                              disabled={lockB2}
                              className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          </td>
                          {showEvaluation && (
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <Select value={target.evaluation} onValueChange={(value) => updateTarget(target.id, "evaluation", value)} disabled={lockB2Evaluation}>
                                <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6" data-testid={`select-target-eval-${target.id}`}>
                                  <SelectValue placeholder="Select Rating" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5-exceeded-set-target">5- Exceeded Set Target</SelectItem>
                                  <SelectItem value="4-fully-met-target">4- Fully Met Target</SelectItem>
                                  <SelectItem value="3-missed-target-small-margin">3- Missed Target by a Small Margin</SelectItem>
                                  <SelectItem value="2-missed-target-significant-margin">2- Missed Target by a Significant Margin</SelectItem>
                                  <SelectItem value="1-failed-to-achieve-target">1- Failed to Achieve Target</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          )}
                          <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                            <div className="flex gap-2 justify-center">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={lockB2Structural} onClick={() => setTargetComments(prev => ({ ...prev, [target.id]: prev[target.id] || "" }))} data-testid={`button-add-target-comment-${target.id}`}>
                                <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                              {!lockB2 && (
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTarget(target.id)} data-testid={`button-delete-target-${target.id}`}>
                                  <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {target.id in targetComments && targetComments[target.id] !== null && (
                          <tr>
                            <td></td>
                            <td colSpan={3} className="p-3">
                              {editingTargetComment === target.id && !lockB2Structural ? (
                                <Textarea
                                  value={targetComments[target.id] ?? ""}
                                  onChange={(e) => { setTargetComments(prev => ({ ...prev, [target.id]: e.target.value })); updateTarget(target.id, "comment", e.target.value); }}
                                  onBlur={() => setEditingTargetComment(null)}
                                  placeholder="Comment: Add your observations here..."
                                  className="text-blue-600 italic border-blue-200"
                                  rows={2}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex justify-between items-start">
                                  <div
                                    className={`flex-1 text-blue-600 italic p-2 rounded text-[13px] ${lockB2Structural ? "" : "cursor-pointer hover:bg-gray-50"}`}
                                    onClick={() => { if (!lockB2Structural) setEditingTargetComment(target.id); }}
                                  >
                                    {targetComments[target.id] || "Click to add comment..."}
                                  </div>
                                  {!lockB2Structural && (
                                    <div className="ml-2">
                                      <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteTargetComment(target.id); }} data-testid={`button-delete-target-comment-${target.id}`}>
                                        <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {form.watch("targets").length === 0 && (
                      <tr>
                        <td colSpan={showEvaluation ? 4 : 3} className="p-8 text-center text-gray-500">
                          No targets added yet. Click "Add Target" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const PartB = memo(PartBComponent);
