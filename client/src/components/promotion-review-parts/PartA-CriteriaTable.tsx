import React, { memo, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Plus, Info, MessageSquare, Trash2 } from 'lucide-react';
import type { CriteriaRow, Comment } from './types';
import { calculateChecklistProgressFromJson, type ChecklistProgressResult } from '@/modules/promotions/checklistProgressUtils';

interface PartACriteriaTableProps extends React.HTMLAttributes<HTMLDivElement> {
  criteriaData: CriteriaRow[];
  vesselTypeOptions: string[];
  selectedVesselTypeForA2_3b: string;
  onVesselTypeChange: (value: string) => void;
  onUpdateVerified: (id: string, value: string) => void;
  isParentCriteria: (id: string) => boolean;
  isOtherCriteriaSubItem: (id: string) => boolean;
  computeParentStatus: (id: string) => 'yes' | 'na' | 'pending';
  computeOtherCriteriaMeetsCriterion: () => 'yes' | 'pending';
  getMeetsCriterionBadge: (required: string, result: string, row: CriteriaRow) => React.ReactNode;
  criteriaComments: Record<string, Comment[]>;
  newCriteriaComment: Record<string, string>;
  onSetNewCriteriaComment: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingCriteriaComment: string | null;
  onSetEditingCriteriaComment: React.Dispatch<React.SetStateAction<string | null>>;
  onSetCriteriaComments: React.Dispatch<React.SetStateAction<Record<string, Comment[]>>>;
  onAddCesTest: () => void;
  onShowChecklistForm: () => void;
  cesTestsSection: React.ReactNode;
  checklistProgressData?: string | null;
  minChecklistVerifications?: number;
  minChecklistCompletionPercent?: number;
}

const getCurrentUserDisplay = (): string => {
  const userName = sessionStorage.getItem('crewUserName') || 'Current User';
  const designation = sessionStorage.getItem('crewDesignation') || 'Staff';
  return `${userName}, ${designation}`;
};

export const PartACriteriaTable = memo(function PartACriteriaTable({
  criteriaData,
  vesselTypeOptions,
  selectedVesselTypeForA2_3b,
  onVesselTypeChange,
  onUpdateVerified,
  isParentCriteria,
  isOtherCriteriaSubItem,
  computeParentStatus,
  computeOtherCriteriaMeetsCriterion,
  getMeetsCriterionBadge,
  criteriaComments,
  newCriteriaComment,
  onSetNewCriteriaComment,
  editingCriteriaComment,
  onSetEditingCriteriaComment,
  onSetCriteriaComments,
  onAddCesTest,
  onShowChecklistForm,
  cesTestsSection,
  checklistProgressData,
  minChecklistVerifications = 0,
  minChecklistCompletionPercent = 100,
  ...restProps
}: PartACriteriaTableProps) {
  const currentUserDisplay = getCurrentUserDisplay();
  
  const checklistProgress = useMemo<ChecklistProgressResult>(() => {
    return calculateChecklistProgressFromJson(
      checklistProgressData,
      minChecklistVerifications,
      minChecklistCompletionPercent
    );
  }, [checklistProgressData, minChecklistVerifications, minChecklistCompletionPercent]);
  const renderCriteriaRow = (row: CriteriaRow) => (
    <React.Fragment key={row.id}>
      <TableRow className={row.id.includes('.') && row.id.split('.').length > 2 ? 'bg-gray-50' : ''}>
        <TableCell className="text-sm">
          <div className="flex items-center gap-2">
            <span className={row.id.includes('.') && row.id.split('.').length > 2 ? 'ml-8' : ''}>{row.criteria}</span>
            {row.hasInfo && row.id !== 'a2.7' && <Info className="h-4 w-4 text-gray-400 cursor-help" />}
          </div>
        </TableCell>
        <TableCell className="text-sm">{row.required}</TableCell>
        <TableCell className="text-sm">
          {row.id === 'a2.3b' ? (
            <div className="flex flex-col gap-2">
              <Select 
                value={selectedVesselTypeForA2_3b} 
                onValueChange={onVesselTypeChange}
              >
                <SelectTrigger className="h-8 text-xs" data-testid="select-vessel-type-a23b">
                  <SelectValue placeholder="Select Vessel Type" />
                </SelectTrigger>
                <SelectContent>
                  {vesselTypeOptions.map((vt: string) => (
                    <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVesselTypeForA2_3b && row.resultFromDb && (
                <span className="text-xs text-gray-600">{row.resultFromDb}</span>
              )}
            </div>
          ) : (
            row.resultFromDb
          )}
        </TableCell>
        <TableCell>
          {row.id === 'a2.6' ? (
            (() => {
              const status = computeOtherCriteriaMeetsCriterion();
              return status === 'yes' ? (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded" data-testid="badge-a26-met">Yes</span>
              ) : (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded" data-testid="badge-a26-pending">Pending</span>
              );
            })()
          ) : isOtherCriteriaSubItem(row.id) || row.id === 'a2.8' ? (
            row.verified === 'yes' ? (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded" data-testid={`badge-meets-yes-${row.id}`}>Yes</span>
            ) : row.verified === 'na' ? (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded" data-testid={`badge-meets-na-${row.id}`}>NA</span>
            ) : null
          ) : (
            getMeetsCriterionBadge(row.required, row.resultFromDb, row)
          )}
        </TableCell>
        <TableCell>
          {isParentCriteria(row.id) ? (
            null
          ) : (
            <RadioGroup 
              value={row.verified} 
              onValueChange={(value) => onUpdateVerified(row.id, value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="yes" 
                  id={`${row.id}-yes`} 
                  data-testid={`radio-verified-yes-${row.id}`}
                  onClick={() => {
                    if (row.verified === 'yes') {
                      onUpdateVerified(row.id, '');
                    }
                  }}
                />
                <Label htmlFor={`${row.id}-yes`} className="text-sm cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="na" 
                  id={`${row.id}-na`} 
                  data-testid={`radio-verified-na-${row.id}`}
                  onClick={() => {
                    if (row.verified === 'na') {
                      onUpdateVerified(row.id, '');
                    }
                  }}
                />
                <Label htmlFor={`${row.id}-na`} className="text-sm cursor-pointer">NA</Label>
              </div>
            </RadioGroup>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0"
              data-testid={`button-criteria-view-${row.id}`}
            >
              <Eye className="h-4 w-4 text-gray-600 promotion-eye-icon" />
            </Button>
            {!isParentCriteria(row.id) && (
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={() => onSetNewCriteriaComment(prev => ({
                  ...prev,
                  [row.id]: ""
                }))}
                data-testid={`button-criteria-comment-${row.id}`}
              >
                <MessageSquare className="h-4 w-4 text-gray-400" />
              </Button>
            )}
            {row.id === 'a2.7' && (
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={onAddCesTest}
                data-testid="button-add-ces-test-inline"
              >
                <Plus className="h-4 w-4 text-gray-600" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      
      {(criteriaComments[row.id]?.length > 0 || newCriteriaComment[row.id] !== undefined) && (
        <TableRow key={`${row.id}-comments`}>
          <TableCell colSpan={6} className="py-2 px-4 bg-gray-50">
            <div className="space-y-2">
              {criteriaComments[row.id]?.map((comment) => (
                <div key={comment.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                    {editingCriteriaComment === comment.id ? (
                      <Textarea
                        value={comment.text}
                        onChange={(e) => {
                          onSetCriteriaComments(prev => ({
                            ...prev,
                            [row.id]: prev[row.id]?.map(c => 
                              c.id === comment.id ? { ...c, text: e.target.value } : c
                            ) || []
                          }));
                        }}
                        onBlur={() => onSetEditingCriteriaComment(null)}
                        autoFocus
                        className="min-h-[80px] w-full"
                      />
                    ) : (
                      <div 
                        className="text-blue-600 italic text-[13px] p-1 cursor-pointer min-h-[20px] border border-transparent hover:border-gray-200 rounded"
                        onClick={() => onSetEditingCriteriaComment(comment.id)}
                      >
                        {comment.text}
                      </div>
                    )}
                  </div>
                  <div className="ml-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onSetCriteriaComments(prev => ({
                          ...prev,
                          [row.id]: prev[row.id]?.filter(c => c.id !== comment.id) || []
                        }));
                        if (editingCriteriaComment === comment.id) {
                          onSetEditingCriteriaComment(null);
                        }
                      }}
                      data-testid={`button-delete-comment-${comment.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {newCriteriaComment[row.id] !== undefined && (
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                  <Textarea
                    value={newCriteriaComment[row.id]}
                    onChange={(e) => {
                      onSetNewCriteriaComment(prev => ({
                        ...prev,
                        [row.id]: e.target.value
                      }));
                    }}
                    onBlur={() => {
                      if (newCriteriaComment[row.id]?.trim()) {
                        const commentId = Date.now().toString();
                        onSetCriteriaComments(prev => ({
                          ...prev,
                          [row.id]: [
                            ...(prev[row.id] || []),
                            {
                              id: commentId,
                              user: currentUserDisplay,
                              text: newCriteriaComment[row.id]
                            }
                          ]
                        }));
                      }
                      onSetNewCriteriaComment(prev => {
                        const newState = { ...prev };
                        delete newState[row.id];
                        return newState;
                      });
                    }}
                    placeholder="Comment: Add your observations here..."
                    className="text-blue-600 italic border-blue-200 text-[13px]"
                    rows={2}
                    autoFocus
                    data-testid={`textarea-new-comment-${row.id}`}
                  />
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );

  return (
    <div className="border border-[#EAEBEF] rounded-lg p-4" {...restProps}>
      <h3 className="text-base font-medium text-[#16569e] mb-4">A2. Minimum Promotion Criteria</h3>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-normal text-gray-600 w-[35%]">Criteria</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[15%]">Required</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[15%]">Result From Database</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[12%]">Meets Criterion</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[13%]">Verified</TableHead>
              <TableHead className="text-xs font-normal text-gray-600 w-[10%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {criteriaData.map((row) => {
              if (row.id === 'a2.5a') {
                const progressBarColor = checklistProgress.meetsThreshold ? 'bg-green-500' : 'bg-[#EAB308]';
                return (
                  <React.Fragment key={row.id}>
                    <TableRow 
                      key="a2.5-progress" 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={onShowChecklistForm}
                      data-testid="row-promotion-checklist-progress"
                    >
                      <TableCell colSpan={2} className="text-sm">A2.5 Promotion Checklist Progress</TableCell>
                      <TableCell colSpan={4}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${progressBarColor}`} 
                              style={{ width: `${checklistProgress.percentage}%` }}
                              data-testid="progress-bar-fill-a25"
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600" data-testid="progress-text-a25">
                            {checklistProgress.percentage}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {renderCriteriaRow(row)}
                  </React.Fragment>
                );
              }

              if (row.id === 'a2.7') {
                return (
                  <React.Fragment key={row.id}>
                    {renderCriteriaRow(row)}
                    {cesTestsSection}
                  </React.Fragment>
                );
              }

              return renderCriteriaRow(row);
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
