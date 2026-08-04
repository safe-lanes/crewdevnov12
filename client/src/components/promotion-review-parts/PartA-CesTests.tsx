import React, { memo } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Trash2 } from 'lucide-react';
import type { CesTest, Comment } from './types';

interface PartACesTestsProps {
  cesTests: CesTest[];
  onUpdateCesTest: (id: string, field: string, value: string) => void;
  onDeleteCesTest: (id: string) => void;
  criteriaComments: Record<string, Comment[]>;
  newCriteriaComment: Record<string, string>;
  editingCriteriaComment: string | null;
  onSetCriteriaComments: React.Dispatch<React.SetStateAction<Record<string, Comment[]>>>;
  onSetNewCriteriaComment: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSetEditingCriteriaComment: (id: string | null) => void;
  currentUserDisplay: string;
}

const computePassFail = (score: string, minScore: string): 'pass' | 'fail' | null => {
  if (!score || !minScore) return null;
  const scoreNum = parseFloat(score);
  const minScoreNum = parseFloat(minScore);
  if (isNaN(scoreNum) || isNaN(minScoreNum)) return null;
  return scoreNum >= minScoreNum ? 'pass' : 'fail';
};

export const PartACesTests = memo(function PartACesTests({
  cesTests,
  onUpdateCesTest,
  onDeleteCesTest,
  criteriaComments,
  newCriteriaComment,
  editingCriteriaComment,
  onSetCriteriaComments,
  onSetNewCriteriaComment,
  onSetEditingCriteriaComment,
  currentUserDisplay,
}: PartACesTestsProps) {
  const handleScoreChange = (testId: string, field: 'score' | 'minScore', value: string, test: CesTest) => {
    onUpdateCesTest(testId, field, value);
    const newScore = field === 'score' ? value : test.score;
    const newMinScore = field === 'minScore' ? value : test.minScore;
    const newResult = computePassFail(newScore, newMinScore);
    onUpdateCesTest(testId, 'result', newResult || '');
  };

  return (
    <>
      {cesTests.map((test, index) => {
        const result = computePassFail(test.score, test.minScore);
        const rowKey = `a2.7-ces-${test.id}`;
        return (
          <React.Fragment key={`ces-${test.id}`}>
          <TableRow className="bg-gray-50">
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <span className="ml-8">
                  A2.7{String.fromCharCode(97 + index)}
                  {test.description && <span className="ml-2 text-gray-600">({test.description})</span>}
                </span>
                <Input 
                  type="date" 
                  className="h-8 text-xs w-32" 
                  placeholder="dd/mm/yyyy"
                  value={test.date}
                  onChange={(e) => onUpdateCesTest(test.id, 'date', e.target.value)}
                  data-testid={`input-ces-date-${test.id}`}
                />
              </div>
            </TableCell>
            <TableCell className="text-sm">
              <Input 
                className="h-8 text-xs w-20" 
                placeholder="Min Score"
                value={test.minScore}
                onChange={(e) => handleScoreChange(test.id, 'minScore', e.target.value, test)}
                data-testid={`input-ces-minscore-${test.id}`}
                disabled
              />
            </TableCell>
            <TableCell className="text-sm">
              <Input 
                className="h-8 text-xs w-20" 
                placeholder="Score"
                value={test.score}
                onChange={(e) => handleScoreChange(test.id, 'score', e.target.value, test)}
                data-testid={`input-ces-score-${test.id}`}
              />
            </TableCell>
            <TableCell>
              {result === 'pass' ? (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded" data-testid={`badge-ces-pass-${test.id}`}>Pass</span>
              ) : result === 'fail' ? (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded" data-testid={`badge-ces-fail-${test.id}`}>Fail</span>
              ) : null}
            </TableCell>
            <TableCell>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <div className="h-7 w-7" aria-hidden="true" />
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0"
                  onClick={() => onSetNewCriteriaComment(prev => ({
                    ...prev,
                    [rowKey]: ""
                  }))}
                  data-testid={`button-criteria-comment-${rowKey}`}
                >
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </TableCell>
          </TableRow>

          {(criteriaComments[rowKey]?.length > 0 || newCriteriaComment[rowKey] !== undefined) && (
            <TableRow key={`${rowKey}-comments`}>
              <TableCell colSpan={6} className="py-2 px-4 bg-gray-50">
                <div className="space-y-2">
                  {criteriaComments[rowKey]?.map((comment) => (
                    <div key={comment.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-blue-600 italic text-[13px] mb-2">{comment.user}:</div>
                        {editingCriteriaComment === comment.id ? (
                          <Textarea
                            value={comment.text}
                            onChange={(e) => {
                              onSetCriteriaComments(prev => ({
                                ...prev,
                                [rowKey]: prev[rowKey]?.map(c => 
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
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-600"
                          onClick={() => {
                            onSetCriteriaComments(prev => ({
                              ...prev,
                              [rowKey]: prev[rowKey]?.filter(c => c.id !== comment.id) || []
                            }));
                            if (editingCriteriaComment === comment.id) {
                              onSetEditingCriteriaComment(null);
                            }
                          }}
                          data-testid={`button-delete-comment-${comment.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {newCriteriaComment[rowKey] !== undefined && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-2">{currentUserDisplay}</div>
                      <Textarea
                        value={newCriteriaComment[rowKey]}
                        onChange={(e) => {
                          onSetNewCriteriaComment(prev => ({
                            ...prev,
                            [rowKey]: e.target.value
                          }));
                        }}
                        onBlur={() => {
                          if (newCriteriaComment[rowKey]?.trim()) {
                            const commentId = Date.now().toString();
                            onSetCriteriaComments(prev => ({
                              ...prev,
                              [rowKey]: [
                                ...(prev[rowKey] || []),
                                {
                                  id: commentId,
                                  user: currentUserDisplay,
                                  text: newCriteriaComment[rowKey]
                                }
                              ]
                            }));
                          }
                          onSetNewCriteriaComment(prev => {
                            const newState = { ...prev };
                            delete newState[rowKey];
                            return newState;
                          });
                        }}
                        placeholder="Comment: Add your observations here..."
                        className="text-blue-600 italic border-blue-200 text-[13px]"
                        rows={2}
                        autoFocus
                        data-testid={`textarea-new-comment-${rowKey}`}
                      />
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
          </React.Fragment>
        );
      })}
    </>
  );
});
