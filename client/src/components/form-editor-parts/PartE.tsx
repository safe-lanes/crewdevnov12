import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { PartEProps } from "./types";

const PartEComponent: React.FC<PartEProps> = ({
  formMethods,
  isConfigMode,
  getDynamicSectionLetter,
  trainingNeeds,
  trainingNeedsComments,
  setTrainingNeedsComments,
  addTrainingNeed,
  updateTrainingNeed,
  deleteTrainingNeed,
}) => {

  return (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('E')}: Training Needs & Development</h3>
        <div style={{ color: '#16569e' }} className="text-sm">Specify any training needs identified during the appraisals period</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      <div className="flex justify-end items-center">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-gray-600 border-gray-300"
            onClick={() => addTrainingNeed('database')}
            data-testid="button-add-training-from-db"
          >
            + Add Training from Database
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-gray-600 border-gray-300"
            onClick={() => addTrainingNeed('new')}
            data-testid="button-add-new-training"
          >
            + Add New Training
          </Button>
        </div>
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
            {trainingNeeds.map((trainingNeed, index) => (
              <React.Fragment key={trainingNeed.id}>
                <tr className="border-t">
                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                    <Input
                      value={trainingNeed.training}
                      onChange={(e) => updateTrainingNeed(trainingNeed.id, "training", e.target.value)}
                      placeholder={`Training ${index + 1}`}
                      className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                      data-testid={`input-training-need-${index}`}
                    />
                  </td>
                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                    <div className="flex gap-2 justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setTrainingNeedsComments(prev => ({
                          ...prev,
                          [trainingNeed.id]: prev[trainingNeed.id] || ""
                        }))}
                        className="h-6 w-6"
                        data-testid={`button-training-need-comment-${index}`}
                      >
                        <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTrainingNeed(trainingNeed.id)}
                        className="h-6 w-6"
                        data-testid={`button-delete-training-need-${index}`}
                      >
                        <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
                {trainingNeedsComments[trainingNeed.id] !== undefined && (
                  <tr key={`comment-${trainingNeed.id}`}>
                    <td></td>
                    <td colSpan={2} className="p-3">
                      <Textarea
                        value={trainingNeedsComments[trainingNeed.id]}
                        onChange={(e) => {
                          setTrainingNeedsComments(prev => ({
                            ...prev,
                            [trainingNeed.id]: e.target.value
                          }));
                          updateTrainingNeed(trainingNeed.id, "comment", e.target.value);
                        }}
                        placeholder="Comment: Add your observations here..."
                        className="text-blue-600 italic border-blue-200"
                        rows={2}
                        data-testid={`textarea-training-need-comment-${index}`}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {trainingNeeds.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500">
                  No training needs added yet. Click "Add Training from Database" or "Add New Training" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const PartE = React.memo(PartEComponent);
