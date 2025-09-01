import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterState {
  searchName: string;
  rank: string;
  vessel: string;
  vesselType: string;
  nationality: string;
  appraisalType: string;
  rating: string;
}

interface ScompFiltersRowProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  onApplyFilters: () => void;
  showFilters: boolean;
}

const rankOptions = [
  "Master", "Chief Mate", "Chief Engineer", "Able Seaman", "Electrician"
];

const vesselOptions = [
  "MT Sail One", "MT Sail Ten", "MT Sail Two", "MT Sail Five", "MT Sail Eight"
];

const vesselTypeOptions = [
  "Oil Tanker", "LPG Tanker", "Container", "Bulk"
];

const nationalityOptions = [
  "British", "Indian"
];

const appraisalTypeOptions = [
  "End of Contract", "Mid Term", "Special", "Probation", "Appraise SIQM"
];

const ratingOptions = [
  "1.0 - 2.0", "2.0 - 3.0", "3.0 - 4.0", "4.0 - 5.0"
];

export default function ScompFiltersRow({
  filters,
  onFiltersChange,
  onClearFilters,
  onApplyFilters,
  showFilters
}: ScompFiltersRowProps) {
  if (!showFilters) return null;

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? '' : value
    });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search by name */}
        <div className="flex-1 min-w-[200px]">
          <Input
            type="text"
            placeholder="Search by name..."
            value={filters.searchName}
            onChange={(e) => handleFilterChange('searchName', e.target.value)}
            className="h-8 text-sm border-gray-300"
          />
        </div>

        {/* Rank filter */}
        <div className="min-w-[140px]">
          <Select value={filters.rank || 'all'} onValueChange={(value) => handleFilterChange('rank', value)}>
            <SelectTrigger className="h-8 text-sm border-gray-300">
              <SelectValue placeholder="Rank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranks</SelectItem>
              {rankOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vessel filter */}
        <div className="min-w-[140px]">
          <Select value={filters.vessel || 'all'} onValueChange={(value) => handleFilterChange('vessel', value)}>
            <SelectTrigger className="h-8 text-sm border-gray-300">
              <SelectValue placeholder="Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {vesselOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vessel Type filter */}
        <div className="min-w-[140px]">
          <Select value={filters.vesselType || 'all'} onValueChange={(value) => handleFilterChange('vesselType', value)}>
            <SelectTrigger className="h-8 text-sm border-gray-300">
              <SelectValue placeholder="Vessel Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {vesselTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Nationality filter */}
        <div className="min-w-[140px]">
          <Select value={filters.nationality || 'all'} onValueChange={(value) => handleFilterChange('nationality', value)}>
            <SelectTrigger className="h-8 text-sm border-gray-300">
              <SelectValue placeholder="Nationality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nationalities</SelectItem>
              {nationalityOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Appraisal Type filter */}
        <div className="min-w-[140px]">
          <Select value={filters.appraisalType || 'all'} onValueChange={(value) => handleFilterChange('appraisalType', value)}>
            <SelectTrigger className="h-8 text-sm border-gray-300">
              <SelectValue placeholder="Appraisal Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {appraisalTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rating filter */}
        <div className="min-w-[140px]">
          <Select value={filters.rating || 'all'} onValueChange={(value) => handleFilterChange('rating', value)}>
            <SelectTrigger className="h-8 text-sm border-gray-300">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              {ratingOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 ml-4">
          <Button
            onClick={onApplyFilters}
            className="h-8 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs px-4"
          >
            Apply
          </Button>
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="h-8 text-gray-700 border-gray-300 hover:bg-gray-50 text-xs px-4"
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}