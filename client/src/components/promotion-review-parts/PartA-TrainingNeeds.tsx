import React, { memo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import type { TrainingRow, Comment } from './types';

interface PartATrainingNeedsProps extends React.HTMLAttributes<HTMLDivElement> {
  trainingNeeds: TrainingRow[];
  onUpdateTraining: (id: string, field: string, value: string) => void;
  onDeleteTraining: (id: string) => void;
  onAddTrainingRow: () => void;
  onOpenTrainingDialog: () => void;
  trainingComments: Record<string, Comment[]>;
  newTrainingComment: Record<string, string>;
  onSetNewTrainingComment: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingTrainingComment: string | null;
  onSetEditingTrainingComment: React.Dispatch<React.SetStateAction<string | null>>;
  onSetTrainingComments: React.Dispatch<React.SetStateAction<Record<string, Comment[]>>>;
}

export const PartATrainingNeeds = memo(function PartATrainingNeeds({
  trainingNeeds,
  onUpdateTraining,
  onDeleteTraining,
  onAddTrainingRow,
  onOpenTrainingDialog,
  trainingComments,
  newTrainingComment,
  onSetNewTrainingComment,
  editingTrainingComment,
  onSetEditingTrainingComment,
  onSetTrainingComments,
  ...restProps
}: PartATrainingNeedsProps) {
  return (
    <div className="border border-[#EAEBEF] rounded-lg p-4" {...restProps}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-medium text-[#16569e]">A3. Identified Training Needs</h3>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={onOpenTrainingDialog}
            data-testid="button-add-training-from-db"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Training from Database
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            className="text-xs" 
            onClick={onAddTrainingRow}
            data-testid="button-add-new-training"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add New Training
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-normal text-gray-600 w-[8%]">S.No.</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[20%]">Training</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[25%]">Corresponding in DB</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[17%]">Category</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[20%]">Status</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[10%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainingNeeds.map((training, index) => (
              <React.Fragment key={training.id}>
                <TableRow>
                  <TableCell className="text-sm" data-testid={`cell-training-sno-${training.id}`}>{index + 1}</TableCell>
                  <TableCell className="text-sm" data-testid={`cell-training-name-${training.id}`}>{training.training}</TableCell>
                  <TableCell>
                    <Select 
                      value={training.correspondingInDB}
                      onValueChange={(value) => onUpdateTraining(training.id, 'correspondingInDB', value)}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`select-training-db-${training.id}`}>
                        <SelectValue placeholder="Select Training from DB" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="training1">Training 1</SelectItem>
                        <SelectItem value="training2">Training 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={training.category}
                      onValueChange={(value) => onUpdateTraining(training.id, 'category', value)}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`select-training-category-${training.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1. Competence">1. Competence</SelectItem>
                        <SelectItem value="2. Soft Skills">2. Soft Skills</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={training.status}
                      onValueChange={(value) => onUpdateTraining(training.id, 'status', value)}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`select-training-status-${training.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Proposed">Proposed</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Planned">Planned</SelectItem>
                        <SelectItem value="Declined">Declined</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0" 
                        onClick={() => onDeleteTraining(training.id)}
                        data-testid={`button-training-delete-${training.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        onClick={() => onSetEditingTrainingComment(editingTrainingComment === training.id ? null : training.id)}
                        data-testid={`button-training-comment-${training.id}`}
                      >
                        <MessageSquare className="h-4 w-4 text-gray-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {(editingTrainingComment === training.id || trainingComments[training.id]?.length > 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-gray-50 p-3">
                      {trainingComments[training.id]?.map((comment) => (
                        <div key={comment.id} className="mb-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-xs font-medium text-gray-700 mb-1">{comment.user}</div>
                              <div 
                                className="text-xs text-blue-600 italic cursor-pointer"
                                onClick={() => {
                                  onSetEditingTrainingComment(training.id);
                                  onSetNewTrainingComment(prev => ({ ...prev, [training.id]: comment.text }));
                                }}
                              >
                                Comment: {comment.text}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                onSetTrainingComments(prev => ({
                                  ...prev,
                                  [training.id]: prev[training.id].filter(c => c.id !== comment.id)
                                }));
                              }}
                              data-testid={`button-delete-training-comment-${comment.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-gray-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {editingTrainingComment === training.id && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-700 mb-1">Roxanne, Crewing Executive</div>
                          <textarea
                            className="w-full h-20 p-2 border rounded text-xs"
                            placeholder="Comment: Add your observations here..."
                            value={newTrainingComment[training.id] || ''}
                            onChange={(e) => onSetNewTrainingComment(prev => ({ ...prev, [training.id]: e.target.value }))}
                            onBlur={() => {
                              const commentText = newTrainingComment[training.id]?.trim();
                              if (commentText) {
                                const newComment: Comment = {
                                  id: `training-comment-${Date.now()}`,
                                  user: 'Roxanne, Crewing Executive',
                                  text: commentText
                                };
                                onSetTrainingComments(prev => ({
                                  ...prev,
                                  [training.id]: [...(prev[training.id] || []), newComment]
                                }));
                              }
                              onSetNewTrainingComment(prev => ({ ...prev, [training.id]: '' }));
                              onSetEditingTrainingComment(null);
                            }}
                            data-testid={`textarea-training-comment-${training.id}`}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
