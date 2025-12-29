import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Info } from 'lucide-react';

interface PartCExecutionProps extends React.HTMLAttributes<HTMLDivElement> {
  promotionConfirmed: string;
  onSetPromotionConfirmed: (value: string) => void;
  vesselAssigned: string;
  onSetVesselAssigned: (value: string) => void;
  promotionDate: string;
  onSetPromotionDate: (value: string) => void;
  promotionTiming: string;
  onSetPromotionTiming: (value: string) => void;
}

export const PartCExecution = memo(function PartCExecution({
  promotionConfirmed,
  onSetPromotionConfirmed,
  vesselAssigned,
  onSetVesselAssigned,
  promotionDate,
  onSetPromotionDate,
  promotionTiming,
  onSetPromotionTiming,
  ...restProps
}: PartCExecutionProps) {
  return (
    <div className="bg-white rounded-lg p-6" {...restProps}>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold text-[#16569e]">Part C - Execution</h2>
          <p className="text-sm text-[#60a5fa] mt-1">To be completed by the crew executive/ crew manager</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-[#16569e]">C.1 Confirmation & Assignment</h3>
            <Info className="h-4 w-4 text-gray-400 cursor-help" />
          </div>

          <div className="flex items-center gap-4">
            <Label className="text-sm w-48">B2.1 Promotion confirmed:</Label>
            <RadioGroup 
              value={promotionConfirmed} 
              onValueChange={onSetPromotionConfirmed}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="promotion-yes" data-testid="radio-promotion-yes" />
                <Label htmlFor="promotion-yes" className="text-sm cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="waitlist" id="promotion-waitlist" data-testid="radio-promotion-waitlist" />
                <Label htmlFor="promotion-waitlist" className="text-sm cursor-pointer">Waitlist</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rejected" id="promotion-rejected" data-testid="radio-promotion-rejected" />
                <Label htmlFor="promotion-rejected" className="text-sm cursor-pointer">Rejected</Label>
              </div>
            </RadioGroup>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 ml-auto"
              data-testid="button-info-promotion-confirmed"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Label className="text-sm w-48">B2.2 Vessel Assigned:</Label>
            <Select 
              value={vesselAssigned}
              onValueChange={onSetVesselAssigned}
            >
              <SelectTrigger className="flex-1" data-testid="select-vessel-assigned">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mt-liberty-gas">MT Liberty Gas</SelectItem>
                <SelectItem value="mt-nordic-star">MT Nordic Star</SelectItem>
                <SelectItem value="mt-ocean-breeze">MT Ocean Breeze</SelectItem>
                <SelectItem value="mt-pacific-dawn">MT Pacific Dawn</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              data-testid="button-info-vessel-assigned"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Label className="text-sm w-48">B2.3 Date of Promotion:</Label>
            <Input 
              type="date" 
              className="w-40"
              placeholder="dd:mm:yy"
              value={promotionDate}
              onChange={(e) => onSetPromotionDate(e.target.value)}
              data-testid="input-promotion-date"
            />
            <RadioGroup 
              value={promotionTiming} 
              onValueChange={onSetPromotionTiming}
              className="flex gap-6 flex-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="on-board" id="timing-on-board" data-testid="radio-timing-on-board" />
                <Label htmlFor="timing-on-board" className="text-sm cursor-pointer">Promoted on board</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="prior-joining" id="timing-prior-joining" data-testid="radio-timing-prior-joining" />
                <Label htmlFor="timing-prior-joining" className="text-sm cursor-pointer">Promoted prior joining</Label>
              </div>
            </RadioGroup>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              data-testid="button-info-promotion-date"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4">
          <p className="text-sm italic text-[#60a5fa]">Submitted by: Roxanne, Crewing Executive</p>
          <div className="flex gap-3">
            <Button 
              type="button"
              variant="outline" 
              className="px-8 bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
              data-testid="button-save-part-c"
            >
              Save
            </Button>
            <Button 
              type="button"
              className="px-8 bg-green-600 hover:bg-green-700"
              data-testid="button-submit-part-c"
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
