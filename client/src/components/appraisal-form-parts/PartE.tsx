import { memo, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { PartEProps } from "./types";

const PartEComponent: React.FC<PartEProps> = ({
  form,
  partRef,
  trainingNeedsComments,
  setTrainingNeedsComments,
  editingTrainingNeedsComment,
  setEditingTrainingNeedsComment,
  addTrainingNeed,
  updateTrainingNeed,
  deleteTrainingNeed,
}) => {
  const deleteTrainingNeedsComment = (id: string) => {
    setTrainingNeedsComments(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div ref={partRef} data-section-id="E">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part E: Training Needs & Development</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Add training needs identified during the appraisal period</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" onClick={addTrainingNeed} variant="outline" size="sm" className="text-gray-600 border-gray-300">
                <Plus className="h-4 w-4 mr-1" />
                Add Training Need
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                    <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                    <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {form.watch("trainingNeeds").map((need, index) => (
                    <Fragment key={need.id}>
                      <tr className="border-t">
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                          <Input
                            value={need.training}
                            onChange={(e) => updateTrainingNeed(need.id, "training", e.target.value)}
                            placeholder="Enter training need"
                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                          />
                        </td>
                        <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                          <div className="flex gap-2 justify-center">
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTrainingNeedsComments(prev => ({ ...prev, [need.id]: prev[need.id] || "" }))}>
                              <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTrainingNeed(need.id)}>
                              <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {trainingNeedsComments[need.id] !== undefined && (
                        <tr>
                          <td></td>
                          <td colSpan={2} className="p-3">
                            {editingTrainingNeedsComment === need.id ? (
                              <Textarea
                                value={trainingNeedsComments[need.id]}
                                onChange={(e) => { setTrainingNeedsComments(prev => ({ ...prev, [need.id]: e.target.value })); updateTrainingNeed(need.id, "comment", e.target.value); }}
                                onBlur={() => setEditingTrainingNeedsComment(null)}
                                placeholder="Comment: Add your observations here..."
                                className="text-blue-600 italic border-blue-200"
                                rows={2}
                                autoFocus
                              />
                            ) : (
                              <div className="flex justify-between items-start">
                                <div className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]" onClick={() => setEditingTrainingNeedsComment(need.id)}>
                                  {trainingNeedsComments[need.id] || "Click to add comment..."}
                                </div>
                                <div className="ml-2">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => deleteTrainingNeedsComment(need.id)}>
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
                  {form.watch("trainingNeeds").length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-500">
                        No training needs added yet. Click "Add Training Need" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const PartE = memo(PartEComponent);
