import React, { memo } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Info, Edit, Trash2 } from 'lucide-react';
import type { CesTest } from './types';

interface PartACesTestsProps {
  cesTests: CesTest[];
  onUpdateCesTest: (id: string, field: string, value: string) => void;
  onDeleteCesTest: (id: string) => void;
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
        return (
          <TableRow key={`ces-${test.id}`} className="bg-gray-50">
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
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0"
                  data-testid={`button-ces-info-${test.id}`}
                >
                  <Info className="h-4 w-4 text-gray-600" />
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0"
                  data-testid={`button-ces-edit-${test.id}`}
                >
                  <Edit className="h-4 w-4 text-gray-600" />
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0"
                  onClick={() => onDeleteCesTest(test.id)}
                  data-testid={`button-ces-delete-${test.id}`}
                >
                  <Trash2 className="h-4 w-4 text-gray-600" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
});
