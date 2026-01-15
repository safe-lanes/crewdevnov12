import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Info, X } from 'lucide-react';
import type { Approver } from './types';
import { useExternalUsers } from '@/hooks/useExternalUsers';

interface PartBApprovalProps extends React.HTMLAttributes<HTMLDivElement> {
  approvers: Approver[];
  onAddApprover: () => void;
  onDeleteApprover: (id: string) => void;
  onUpdateApprover: (id: string, field: string, value: string) => void;
  vesselTypes: string[];
  vesselClasses: string[];
  onRemoveVesselType: (type: string) => void;
  onRemoveVesselClass: (cls: string) => void;
  onSave?: () => void;
  onSubmit?: () => void;
}

export const PartBApproval = memo(function PartBApproval({
  approvers,
  onAddApprover,
  onDeleteApprover,
  onUpdateApprover,
  vesselTypes,
  vesselClasses,
  onRemoveVesselType,
  onRemoveVesselClass,
  onSave,
  onSubmit,
  ...restProps
}: PartBApprovalProps) {
  const { data: externalUsers = [] } = useExternalUsers();

  return (
    <div className="bg-white rounded-lg p-6" {...restProps}>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold text-[#16569e]">Part B - Approval</h2>
          <p className="text-sm text-[#60a5fa] mt-1">To be completed by the designated approver</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium text-[#16569e]">B1 Approved?</h3>
              <Info className="h-4 w-4 text-gray-400 cursor-help" />
            </div>
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              className="text-xs" 
              onClick={onAddApprover}
              data-testid="button-add-approver"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Approver
            </Button>
          </div>

          {approvers.map((approver) => (
            <div key={approver.id} className="space-y-2" data-testid={`approver-${approver.id}`}>
              <div className="flex items-center gap-3">
                <Input 
                  type="date" 
                  className="h-9 w-40 text-xs"
                  placeholder="dd:mm:yy"
                  value={approver.date}
                  onChange={(e) => onUpdateApprover(approver.id, 'date', e.target.value)}
                  data-testid={`input-approver-date-${approver.id}`}
                />
                {approver.isFromPartA ? (
                  <div 
                    className="h-9 text-xs flex-1 flex items-center px-3 border border-gray-200 rounded-md bg-gray-50 text-gray-700"
                    data-testid={`text-approver-readonly-${approver.id}`}
                  >
                    {approver.approver}
                  </div>
                ) : (
                  <Select 
                    value={approver.approver}
                    onValueChange={(value) => onUpdateApprover(approver.id, 'approver', value)}
                  >
                    <SelectTrigger className="h-9 text-xs flex-1" data-testid={`select-approver-${approver.id}`}>
                      <SelectValue placeholder="Select Approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {externalUsers.map((user: any) => (
                        <SelectItem key={user.uuid} value={user.userName}>
                          {user.userName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select 
                  value={approver.status}
                  onValueChange={(value) => onUpdateApprover(approver.id, 'status', value)}
                >
                  <SelectTrigger className="h-9 text-xs w-32" data-testid={`select-status-${approver.id}`}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <RadioGroup 
                  value={approver.approval} 
                  onValueChange={(value) => onUpdateApprover(approver.id, 'approval', value)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id={`${approver.id}-yes`} data-testid={`radio-approval-yes-${approver.id}`} />
                    <Label htmlFor={`${approver.id}-yes`} className="text-sm cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes-conditional" id={`${approver.id}-yes-conditional`} data-testid={`radio-approval-conditional-${approver.id}`} />
                    <Label htmlFor={`${approver.id}-yes-conditional`} className="text-sm cursor-pointer">Yes, Conditional</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id={`${approver.id}-no`} data-testid={`radio-approval-no-${approver.id}`} />
                    <Label htmlFor={`${approver.id}-no`} className="text-sm cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => onDeleteApprover(approver.id)}
                  data-testid={`button-delete-approver-${approver.id}`}
                >
                  <Plus className="h-4 w-4 text-gray-600 rotate-45" />
                </Button>
              </div>
              {approver.comments && (
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-blue-600 italic whitespace-pre-line" data-testid={`approver-comments-${approver.id}`}>
                    {approver.comments}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-medium text-[#16569e]">B2 Suitable for:</h3>
          
          <div className="flex items-center gap-4">
            <Label className="text-sm w-48">B2.1 Vessel type(s):</Label>
            <div className="flex-1 flex items-center gap-2 flex-wrap border border-gray-300 rounded-md p-2 min-h-[36px]" data-testid="vessel-types-container">
              {vesselTypes.map((type) => (
                <div key={type} className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] px-2 py-1 rounded text-sm" data-testid={`vessel-type-${type.toLowerCase().replace(/\s+/g, '-')}`}>
                  {type}
                  <button 
                    type="button"
                    onClick={() => onRemoveVesselType(type)} 
                    className="ml-1"
                    data-testid={`button-remove-vessel-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              data-testid="button-add-vessel-type"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Label className="text-sm w-48">B2.2 Vessel/ Vessel Class/ Fleet:</Label>
            <div className="flex-1 flex items-center gap-2 flex-wrap border border-gray-300 rounded-md p-2 min-h-[36px]" data-testid="vessel-classes-container">
              {vesselClasses.map((cls) => (
                <div key={cls} className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] px-2 py-1 rounded text-sm" data-testid={`vessel-class-${cls.toLowerCase().replace(/\s+/g, '-')}`}>
                  {cls}
                  <button 
                    type="button"
                    onClick={() => onRemoveVesselClass(cls)} 
                    className="ml-1"
                    data-testid={`button-remove-vessel-class-${cls.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              data-testid="button-add-vessel-class"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button 
            type="button"
            variant="outline" 
            className="px-8 bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
            onClick={onSave}
            data-testid="button-save-part-b"
          >
            Save
          </Button>
          <Button 
            type="button"
            className="px-8 bg-green-600 hover:bg-green-700"
            onClick={onSubmit}
            data-testid="button-submit-part-b"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
});
