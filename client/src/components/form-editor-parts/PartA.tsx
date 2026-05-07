import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartAProps } from "./types";

const PartAComponent: React.FC<PartAProps> = ({
  formMethods,
  isConfigMode,
  fieldVisibility,
  toggleFieldVisibility,
  appraisalTypeOptions,
  piCategoryOptions,
}) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="pb-3 sm:pb-4 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A: Seafarer's Information</h3>
        <div style={{ color: '#16569e' }} className="text-xs sm:text-sm">Enter details as applicable</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="seafarersName" className="text-sm">Seafarer's Name</Label>
          <Input
            id="seafarersName"
            placeholder="James Michael"
            {...formMethods.register("seafarersName")}
            className="text-sm"
            data-testid="input-seafarers-name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="seafarersRank" className="text-sm">Seafarer's Rank</Label>
          <Select
            value={formMethods.watch("seafarersRank") || ""}
            onValueChange={(value) => formMethods.setValue("seafarersRank", value)}
          >
            <SelectTrigger className="text-sm" data-testid="select-seafarers-rank">
              <SelectValue placeholder="Select rank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="master">Master</SelectItem>
              <SelectItem value="chief-officer">Chief Officer</SelectItem>
              <SelectItem value="second-officer">Second Officer</SelectItem>
              <SelectItem value="third-officer">Third Officer</SelectItem>
              <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
              <SelectItem value="second-engineer">Second Engineer</SelectItem>
              <SelectItem value="third-engineer">Third Engineer</SelectItem>
              <SelectItem value="able-seaman">Able Bodied Seaman</SelectItem>
              <SelectItem value="bosun">Bosun</SelectItem>
              <SelectItem value="cook">Cook</SelectItem>
              <SelectItem value="steward">Steward</SelectItem>
              <SelectItem value="electrician">Electrician</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="nationality" className="text-sm">Nationality</Label>
          <Select
            value={formMethods.watch("nationality") || ""}
            onValueChange={(value) => formMethods.setValue("nationality", value)}
          >
            <SelectTrigger className="text-sm" data-testid="select-nationality">
              <SelectValue placeholder="Select nationality..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="british">British</SelectItem>
              <SelectItem value="indian">Indian</SelectItem>
              <SelectItem value="philippines">Philippines</SelectItem>
              <SelectItem value="german">German</SelectItem>
              <SelectItem value="norwegian">Norwegian</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vessel" className="text-sm">Vessel</Label>
          <Select
            value={formMethods.watch("vessel") || ""}
            onValueChange={(value) => formMethods.setValue("vessel", value)}
          >
            <SelectTrigger className="text-sm" data-testid="select-vessel">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mt-sail-one">MT Sail One</SelectItem>
              <SelectItem value="mt-sail-two">MT Sail Two</SelectItem>
              <SelectItem value="mt-sail-three">MT Sail Three</SelectItem>
              <SelectItem value="mv-sail-seven">MV Sail Seven</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signOn" className="text-sm">Sign On Date</Label>
          <Input
            id="signOn"
            type="date"
            {...formMethods.register("signOn")}
            className="text-sm"
            data-testid="input-sign-on"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="appraisalType" className="text-sm">Appraisal Type</Label>
          <Select
            value={formMethods.watch("appraisalType") || ""}
            onValueChange={(value) => formMethods.setValue("appraisalType", value)}
          >
            <SelectTrigger className="text-sm" data-testid="select-appraisal-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {appraisalTypeOptions.map((option, index) => (
                <SelectItem key={index} value={option.toLowerCase().replace(/\s+/g, '-')}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="appraisalPeriodFrom" className="text-sm">Appraisal Period From</Label>
          <Input
            id="appraisalPeriodFrom"
            type="date"
            {...formMethods.register("appraisalPeriodFrom")}
            className="text-sm"
            data-testid="input-appraisal-period-from"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="appraisalPeriodTo" className="text-sm">Appraisal Period To</Label>
          <Input
            id="appraisalPeriodTo"
            type="date"
            {...formMethods.register("appraisalPeriodTo")}
            className="text-sm"
            data-testid="input-appraisal-period-to"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primaryAppraiser" className="text-sm">Primary Appraiser</Label>
          <Select
            value={formMethods.watch("primaryAppraiser") || ""}
            onValueChange={(value) => formMethods.setValue("primaryAppraiser", value)}
          >
            <SelectTrigger className="text-sm" data-testid="select-primary-appraiser">
              <SelectValue placeholder="Select appraiser" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="captain-smith">Captain Smith</SelectItem>
              <SelectItem value="chief-engineer-jones">Chief Engineer Jones</SelectItem>
              <SelectItem value="fleet-manager">Fleet Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(isConfigMode || fieldVisibility.personalityIndexCategory) && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <Label htmlFor="personalityIndexCategory" className="text-sm">
              Personality Index (PI) Category
            </Label>
          </div>
          {isConfigMode && (
            <p className="text-xs text-gray-500 italic" data-testid="text-pi-runtime-only-note">
              Runtime-only — filled at appraisal time
            </p>
          )}
          <Select
            value={formMethods.watch("personalityIndexCategory") || ""}
            onValueChange={(value) => formMethods.setValue("personalityIndexCategory", value)}
            disabled={isConfigMode}
          >
            <SelectTrigger
              className="w-full text-sm"
              data-testid="select-pi-category"
              aria-disabled={isConfigMode}
            >
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {piCategoryOptions.map((option, index) => (
                <SelectItem key={index} value={option.toLowerCase().replace(/\s+/g, '-')}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export const PartA = React.memo(PartAComponent);
