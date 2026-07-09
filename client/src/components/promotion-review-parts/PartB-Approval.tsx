import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Info, X } from 'lucide-react';
import type { Approver } from './types';

interface PartBApprovalProps extends React.HTMLAttributes<HTMLDivElement> {
  approvers: Approver[];
  onAddApprover: () => void;
  onDeleteApprover: (id: string) => void;
  onUpdateApprover: (id: string, field: string, value: string) => void;
  vesselTypes: string[];
  vesselClasses: string[];
  onRemoveVesselType: (type: string) => void;
  onRemoveVesselClass: (cls: string) => void;
  onAddVesselType?: (type: string) => void;
  onAddVesselClass?: (cls: string) => void;
  vesselTypeOptions?: string[];
  vesselClassOptions?: string[];
  isLoadingVesselTypeOptions?: boolean;
  isLoadingVesselClassOptions?: boolean;
  promotionConfirmed: string;
  onSetPromotionConfirmed: (value: string) => void;
  promotionTiming: string;
  onSetPromotionTiming: (value: string) => void;
  onSave?: () => void;
  onSubmit?: () => void;
  approverNames?: string[];
  disabled?: boolean;
}

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-');

export const PartBApproval = memo(function PartBApproval({
  approvers,
  onAddApprover,
  onDeleteApprover,
  onUpdateApprover,
  vesselTypes,
  vesselClasses,
  onRemoveVesselType,
  onRemoveVesselClass,
  onAddVesselType,
  onAddVesselClass,
  vesselTypeOptions = [],
  vesselClassOptions = [],
  isLoadingVesselTypeOptions = false,
  isLoadingVesselClassOptions = false,
  promotionConfirmed,
  onSetPromotionConfirmed,
  promotionTiming,
  onSetPromotionTiming,
  onSave,
  onSubmit,
  approverNames = [],
  disabled = false,
  ...restProps
}: PartBApprovalProps) {

  const availableVesselTypes = vesselTypeOptions.filter((t) => !vesselTypes.includes(t));
  const availableVesselClasses = vesselClassOptions.filter((c) => !vesselClasses.includes(c));

  const usedApproverNames = React.useMemo(
    () => new Set(approvers.map((a) => a.approver).filter(Boolean)),
    [approvers]
  );

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
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-9 text-xs flex-1" data-testid={`select-approver-${approver.id}`}>
                      <SelectValue placeholder="Select Approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {approverNames.map((name: string) => (
                        <SelectItem
                          key={name}
                          value={name}
                          disabled={usedApproverNames.has(name) && name !== approver.approver}
                        >
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select 
                  value={approver.status}
                  onValueChange={(value) => onUpdateApprover(approver.id, 'status', value)}
                  disabled={disabled}
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
                  disabled={disabled}
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
                {!approver.isFromPartA && (
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
                )}
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

          <div className="flex items-start gap-4">
            <Label className="text-sm w-48 mt-2">B2.1 Vessel type(s):</Label>
            <div className="flex-1 space-y-2">
              {vesselTypes.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap" data-testid="vessel-types-container">
                  {vesselTypes.map((type) => (
                    <div
                      key={type}
                      className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] px-2 py-1 rounded text-sm"
                      data-testid={`vessel-type-${slugify(type)}`}
                    >
                      {type}
                      <button
                        type="button"
                        onClick={() => onRemoveVesselType(type)}
                        className="ml-1"
                        data-testid={`button-remove-vessel-type-${slugify(type)}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Select
                value=""
                onValueChange={(value) => onAddVesselType?.(value)}
                disabled={!onAddVesselType || disabled}
              >
                <SelectTrigger className="w-full max-w-md h-9 text-sm" data-testid="select-add-vessel-type">
                  <SelectValue
                    placeholder={isLoadingVesselTypeOptions ? 'Loading options...' : 'Add vessel type...'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingVesselTypeOptions && (
                    <SelectItem value="_loading" disabled>Loading options...</SelectItem>
                  )}
                  {!isLoadingVesselTypeOptions && availableVesselTypes.length === 0 && (
                    <SelectItem value="_empty" disabled>No options available</SelectItem>
                  )}
                  {availableVesselTypes.map((vesselType) => (
                    <SelectItem key={vesselType} value={vesselType}>
                      {vesselType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Label className="text-sm w-48 mt-2">B2.2 Vessel/ Vessel Class/ Fleet:</Label>
            <div className="flex-1 space-y-2">
              {vesselClasses.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap" data-testid="vessel-classes-container">
                  {vesselClasses.map((cls) => (
                    <div
                      key={cls}
                      className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] px-2 py-1 rounded text-sm"
                      data-testid={`vessel-class-${slugify(cls)}`}
                    >
                      {cls}
                      <button
                        type="button"
                        onClick={() => onRemoveVesselClass(cls)}
                        className="ml-1"
                        data-testid={`button-remove-vessel-class-${slugify(cls)}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Select
                value=""
                onValueChange={(value) => onAddVesselClass?.(value)}
                disabled={!onAddVesselClass || disabled}
              >
                <SelectTrigger className="w-full max-w-md h-9 text-sm" data-testid="select-add-vessel-class">
                  <SelectValue
                    placeholder={isLoadingVesselClassOptions ? 'Loading options...' : 'Add fleet group...'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingVesselClassOptions && (
                    <SelectItem value="_loading" disabled>Loading options...</SelectItem>
                  )}
                  {!isLoadingVesselClassOptions && availableVesselClasses.length === 0 && (
                    <SelectItem value="_empty" disabled>No options available</SelectItem>
                  )}
                  {availableVesselClasses.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-base font-medium text-[#16569e]">B3 Promotion Decision</h3>

          <div className="flex items-start gap-4">
            <Label className="text-sm w-48 mt-2">B3.1 Decision:</Label>
            <RadioGroup
              value={promotionConfirmed}
              onValueChange={onSetPromotionConfirmed}
              className="flex flex-wrap gap-6"
              data-testid="radiogroup-promotion-decision"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="promotion-decision-yes" data-testid="radio-promotion-decision-yes" />
                <Label htmlFor="promotion-decision-yes" className="text-sm cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="waitlist" id="promotion-decision-waitlist" data-testid="radio-promotion-decision-waitlist" />
                <Label htmlFor="promotion-decision-waitlist" className="text-sm cursor-pointer">Waitlist</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rejected" id="promotion-decision-rejected" data-testid="radio-promotion-decision-rejected" />
                <Label htmlFor="promotion-decision-rejected" className="text-sm cursor-pointer">Rejected</Label>
              </div>
            </RadioGroup>
          </div>

          {promotionConfirmed === 'yes' && (
            <div className="flex items-start gap-4">
              <Label className="text-sm w-48 mt-2">B3.2 Promotion type:</Label>
              <RadioGroup
                value={promotionTiming}
                onValueChange={onSetPromotionTiming}
                className="flex flex-wrap gap-6"
                data-testid="radiogroup-promotion-type"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="on-board" id="promotion-type-on-board" data-testid="radio-promotion-type-on-board" />
                  <Label htmlFor="promotion-type-on-board" className="text-sm cursor-pointer">Promoted Onboard</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prior-joining" id="promotion-type-prior-joining" data-testid="radio-promotion-type-prior-joining" />
                  <Label htmlFor="promotion-type-prior-joining" className="text-sm cursor-pointer">Promoted Prior Joining</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {/* Hidden from UI only (per request) — button remains fully functional/wired (onClick={onSave}); do not remove or disconnect its logic. */}
          <Button 
            type="button"
            variant="outline" 
            className="hidden px-8 bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
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
