import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MessageSquare, Edit2, Trash2 } from "lucide-react";
import { PartGProps } from "./types";

const PartGComponent: React.FC<PartGProps> = ({
  formMethods,
  isConfigMode,
  getDynamicSectionLetter,
  trainingFollowups,
  trainingFollowupComments,
  setTrainingFollowupComments,
  trainingCategoryOptions,
  trainingStatusOptions,
  addTrainingFollowup,
  updateTrainingFollowup,
  deleteTrainingFollowup,
}) => {

  return (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('G')}: Office Review & Followup</h3>
        <div style={{ color: '#16569e' }} className="text-sm">This section is visible to office users only</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>G1. Office Review</h3>
        <div className="space-y-2">
          <Label htmlFor="officeReviewComments">Office Review Comments</Label>
          <Textarea
            id="officeReviewComments"
            placeholder="Office review and additional comments..."
            {...formMethods.register("officeReviewComments")}
            rows={4}
            data-testid="textarea-office-review-comments"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>G2. Training Follow-up</h3>
        
        <div className="space-y-4">
          {!isConfigMode && (
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Training Follow-up Actions</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTrainingFollowup('database')}
                  className="flex items-center gap-1"
                  data-testid="button-add-followup-from-db"
                >
                  <Plus className="h-3 w-3" />
                  Add from Database
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTrainingFollowup('new')}
                  className="flex items-center gap-1"
                  data-testid="button-add-new-followup"
                >
                  <Plus className="h-3 w-3" />
                  Add New
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Corresponding in DB</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Category</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Status</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Date</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isConfigMode ? (
                  <tr className="border-b">
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Input
                        placeholder="Training name"
                        value=""
                        readOnly
                        className="w-full bg-gray-50 text-[13px] h-6"
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select disabled>
                        <SelectTrigger className="w-full bg-gray-50 text-[13px] h-6">
                          <SelectValue placeholder="Select Training from DB" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Select Training from DB">Select Training from DB</SelectItem>
                          <SelectItem value="STCW Basic Safety Training">STCW Basic Safety Training</SelectItem>
                          <SelectItem value="Advanced Fire Fighting">Advanced Fire Fighting</SelectItem>
                          <SelectItem value="Medical First Aid">Medical First Aid</SelectItem>
                          <SelectItem value="Ship Security Officer">Ship Security Officer</SelectItem>
                          <SelectItem value="Bridge Resource Management">Bridge Resource Management</SelectItem>
                          <SelectItem value="Engine Resource Management">Engine Resource Management</SelectItem>
                          <SelectItem value="Leadership and Management">Leadership and Management</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select disabled>
                        <SelectTrigger className="w-full bg-gray-50 text-[13px] h-6">
                          <SelectValue placeholder="Select Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {trainingCategoryOptions.map((option, optionIndex) => (
                            <SelectItem key={optionIndex} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select disabled>
                        <SelectTrigger className="w-full bg-gray-50 text-[13px] h-6">
                          <SelectValue placeholder="Proposed" />
                        </SelectTrigger>
                        <SelectContent>
                          {trainingStatusOptions.map((option, optionIndex) => (
                            <SelectItem key={optionIndex} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Input
                        type="date"
                        value=""
                        readOnly
                        className="w-full bg-gray-50 text-[13px] h-6"
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          className="text-gray-400 h-6 w-6"
                        >
                          <MessageSquare className="h-[18px] w-[18px]" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          className="text-gray-400 h-6 w-6"
                        >
                          <Edit2 className="h-[18px] w-[18px]" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          className="text-gray-400 h-6 w-6"
                        >
                          <Trash2 className="h-[18px] w-[18px]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  trainingFollowups.map((followup, index) => (
                    <tr key={followup.id} className="border-b">
                      <td className="p-3">
                        <div className="space-y-1">
                          <Input
                            placeholder="Training name"
                            value={followup.training}
                            onChange={(e) => updateTrainingFollowup(followup.id, 'training', e.target.value)}
                            className="w-full"
                            data-testid={`input-followup-training-${index}`}
                          />
                          {trainingFollowupComments[followup.id] && (
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {trainingFollowupComments[followup.id]}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Select
                          value={followup.correspondingInDB}
                          onValueChange={(value) => updateTrainingFollowup(followup.id, 'correspondingInDB', value)}
                        >
                          <SelectTrigger className="w-full" data-testid={`select-followup-db-${index}`}>
                            <SelectValue placeholder="Select Training from DB" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Select Training from DB">Select Training from DB</SelectItem>
                            <SelectItem value="STCW Basic Safety Training">STCW Basic Safety Training</SelectItem>
                            <SelectItem value="Advanced Fire Fighting">Advanced Fire Fighting</SelectItem>
                            <SelectItem value="Medical First Aid">Medical First Aid</SelectItem>
                            <SelectItem value="Ship Security Officer">Ship Security Officer</SelectItem>
                            <SelectItem value="Bridge Resource Management">Bridge Resource Management</SelectItem>
                            <SelectItem value="Engine Resource Management">Engine Resource Management</SelectItem>
                            <SelectItem value="Leadership and Management">Leadership and Management</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Select
                          value={followup.category}
                          onValueChange={(value) => updateTrainingFollowup(followup.id, 'category', value)}
                        >
                          <SelectTrigger className="w-full" data-testid={`select-followup-category-${index}`}>
                            <SelectValue placeholder="Select Rating" />
                          </SelectTrigger>
                          <SelectContent>
                            {trainingCategoryOptions.map((option, optionIndex) => (
                              <SelectItem key={optionIndex} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Select
                          value={followup.status}
                          onValueChange={(value) => updateTrainingFollowup(followup.id, 'status', value)}
                        >
                          <SelectTrigger className="w-full" data-testid={`select-followup-status-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {trainingStatusOptions.map((option, optionIndex) => (
                              <SelectItem key={optionIndex} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Input
                          type="date"
                          value={followup.targetDate}
                          onChange={(e) => updateTrainingFollowup(followup.id, 'targetDate', e.target.value)}
                          className="w-full"
                          data-testid={`input-followup-date-${index}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const currentComment = trainingFollowupComments[followup.id] || followup.comment || "";
                              const newComment = prompt("Enter comment:", currentComment);
                              if (newComment !== null) {
                                setTrainingFollowupComments(prev => ({
                                  ...prev,
                                  [followup.id]: newComment
                                }));
                                updateTrainingFollowup(followup.id, 'comment', newComment);
                              }
                            }}
                            className="text-blue-600 hover:text-blue-700"
                            data-testid={`button-followup-comment-${index}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-700"
                            data-testid={`button-followup-edit-${index}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTrainingFollowup(followup.id)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-followup-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PartG = React.memo(PartGComponent);
