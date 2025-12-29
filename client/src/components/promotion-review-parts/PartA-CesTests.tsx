import React, { memo } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, Edit, Trash2 } from 'lucide-react';
import type { CesTest } from './types';

interface PartACesTestsProps {
  cesTests: CesTest[];
  onUpdateCesTest: (id: string, field: string, value: string) => void;
  onDeleteCesTest: (id: string) => void;
}

export const PartACesTests = memo(function PartACesTests({
  cesTests,
  onUpdateCesTest,
  onDeleteCesTest,
}: PartACesTestsProps) {
  return (
    <>
      {cesTests.map((test, index) => (
        <TableRow key={`ces-${test.id}`} className="bg-gray-50">
          <TableCell className="text-sm">
            A2.7{String.fromCharCode(97 + index)}
            {test.description && <span className="ml-2 text-gray-600">({test.description})</span>}
          </TableCell>
          <TableCell>
            <Input 
              type="date" 
              className="h-8 text-xs" 
              placeholder="Date"
              value={test.date}
              onChange={(e) => onUpdateCesTest(test.id, 'date', e.target.value)}
              data-testid={`input-ces-date-${test.id}`}
            />
          </TableCell>
          <TableCell>
            <Input 
              className="h-8 text-xs" 
              placeholder="Min Score"
              value={test.minScore}
              onChange={(e) => onUpdateCesTest(test.id, 'minScore', e.target.value)}
              data-testid={`input-ces-minscore-${test.id}`}
            />
          </TableCell>
          <TableCell>
            <Input 
              className="h-8 text-xs" 
              placeholder="Score"
              value={test.score}
              onChange={(e) => onUpdateCesTest(test.id, 'score', e.target.value)}
              data-testid={`input-ces-score-${test.id}`}
            />
          </TableCell>
          <TableCell>
            <Select 
              value={test.result}
              onValueChange={(value) => onUpdateCesTest(test.id, 'result', value)}
            >
              <SelectTrigger className="h-8 text-xs" data-testid={`select-ces-result-${test.id}`}>
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
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
      ))}
    </>
  );
});
