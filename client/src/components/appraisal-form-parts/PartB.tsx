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

const PartBComponent: React.FC<PartBProps> = ({
  form,
  partRef,
  isSectionVisible,
  showEvaluation,
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
}) => {
  const deleteTrainingComment = (id: string) => {
    setTrainingComments(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const deleteTargetComment = (id: string) => {
    setTargetComments(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  if (!isSectionVisible('partB')) return null;

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
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-[16px]" style={{ color: '#16569e' }}>B1. Trainings conducted prior joining vessel (To Assess Effectiveness)</h3>
                <Button type="button" onClick={addTraining} variant="outline" size="sm" className="text-gray-600 border-gray-300">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Training
                </Button>
              </div>
              
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                        {showEvaluation && <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>}
                        <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {form.watch("trainings").map((training, index) => (
                        <Fragment key={training.id}>
                          <tr className="border-b border-gray-200 bg-white hover:bg-gray-50">
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <Input
                                value={training.training}
                                onChange={(e) => updateTraining(training.id, "training", e.target.value)}
                                placeholder={`Training ${index + 1}`}
                                className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                              />
                            </td>
                            {showEvaluation && (
                              <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                <Select value={training.evaluation} onValueChange={(value) => updateTraining(training.id, "evaluation", value)}>
                                  <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTrainingComments(prev => ({ ...prev, [training.id]: prev[training.id] || "" }))}>
                                  <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTraining(training.id)}>
                                  <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {trainingComments[training.id] !== undefined && (
                            <tr>
                              <td></td>
                              <td colSpan={3} className="p-3">
                                {editingTrainingComment === training.id ? (
                                  <Textarea
                                    value={trainingComments[training.id]}
                                    onChange={(e) => { setTrainingComments(prev => ({ ...prev, [training.id]: e.target.value })); updateTraining(training.id, "comment", e.target.value); }}
                                    onBlur={() => setEditingTrainingComment(null)}
                                    placeholder="Comment: Add your observations here..."
                                    className="text-blue-600 italic border-blue-200"
                                    rows={2}
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]" onClick={() => setEditingTrainingComment(training.id)}>
                                      {trainingComments[training.id] || "Click to add comment..."}
                                    </div>
                                    <div className="ml-2">
                                      <Button type="button" variant="ghost" size="sm" onClick={() => deleteTrainingComment(training.id)}>
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
                      {form.watch("trainings").length === 0 && (
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

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-[16px]" style={{ color: '#16569e' }}>B2. Target Setting</h3>
                <Button type="button" onClick={addTarget} variant="outline" size="sm" className="text-gray-600 border-gray-300">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Target
                </Button>
              </div>
              
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Setting</th>
                      {showEvaluation && <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>}
                      <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
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
                              className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                            />
                          </td>
                          {showEvaluation && (
                            <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                              <Select value={target.evaluation} onValueChange={(value) => updateTarget(target.id, "evaluation", value)}>
                                <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
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
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTargetComments(prev => ({ ...prev, [target.id]: prev[target.id] || "" }))}>
                                <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTarget(target.id)}>
                                <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {targetComments[target.id] !== undefined && (
                          <tr>
                            <td></td>
                            <td colSpan={3} className="p-3">
                              {editingTargetComment === target.id ? (
                                <Textarea
                                  value={targetComments[target.id]}
                                  onChange={(e) => { setTargetComments(prev => ({ ...prev, [target.id]: e.target.value })); updateTarget(target.id, "comment", e.target.value); }}
                                  onBlur={() => setEditingTargetComment(null)}
                                  placeholder="Comment: Add your observations here..."
                                  className="text-blue-600 italic border-blue-200"
                                  rows={2}
                                  autoFocus
                                />
                              ) : (
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]" onClick={() => setEditingTargetComment(target.id)}>
                                    {targetComments[target.id] || "Click to add comment..."}
                                  </div>
                                  <div className="ml-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteTargetComment(target.id)}>
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
                    {form.watch("targets").length === 0 && (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const PartB = memo(PartBComponent);
