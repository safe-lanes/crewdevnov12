/**
 * Main crew listing page
 */

import React, { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrewTable } from "../components/CrewTable";
import { useCrewMembers, useDeleteCrewMember } from "../hooks/useCrew";
import { useAppraisals } from "../hooks/useCrew";
import { CrewAppraisalData, CrewFilters } from "../types/crew.types";
import { ALL_RANKS, VESSEL_TYPES } from "@/utils/data/ranks";
import { NATIONALITIES } from "@/utils/data/nationalities";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function CrewingListPage() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<CrewFilters>({});
  const [deleteCrewId, setDeleteCrewId] = useState<string | null>(null);

  // Fetch data
  const { data: crewMembers = [], isLoading: crewLoading, refetch } = useCrewMembers(filters);
  const { data: appraisals = [] } = useAppraisals();
  const deleteCrewMutation = useDeleteCrewMember();

  // Combine crew data with appraisal data
  const enrichedCrewData = useMemo<CrewAppraisalData[]>(() => {
    return crewMembers.map(crew => {
      const fullName = [crew.firstName, crew.middleName, crew.lastName]
        .filter(Boolean)
        .join(' ');
      
      // Calculate time on board
      const signOnDate = new Date(crew.signOnDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - signOnDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const timeOnBoard = diffDays < 30 
        ? `${diffDays} days`
        : `${Math.floor(diffDays / 30)} months`;

      // Find latest appraisal
      const crewAppraisals = appraisals.filter(appraisal => appraisal.crewMemberId === crew.id);
      const latestAppraisal = crewAppraisals.sort((a, b) => 
        new Date(b.appraisalDate).getTime() - new Date(a.appraisalDate).getTime()
      )[0];

      // Parse ratings from appraisal data
      let competenceRating = { value: '0.0', color: '' };
      let behavioralRating = { value: '0.0', color: '' };
      let overallRating = { value: '0.0', color: '' };

      if (latestAppraisal) {
        if (latestAppraisal.competenceRating) {
          competenceRating = { value: latestAppraisal.competenceRating, color: '' };
        }
        if (latestAppraisal.behavioralRating) {
          behavioralRating = { value: latestAppraisal.behavioralRating, color: '' };
        }
        if (latestAppraisal.overallRating) {
          overallRating = { value: latestAppraisal.overallRating, color: '' };
        }
      }

      return {
        ...crew,
        fullName,
        timeOnBoard,
        latestAppraisal,
        competenceRating,
        behavioralRating,
        overallRating,
      };
    });
  }, [crewMembers, appraisals]);

  // Filter options
  const rankOptions = ALL_RANKS.map(rank => ({ value: rank, label: rank }));
  const vesselTypeOptions = VESSEL_TYPES.map(type => ({ value: type, label: type }));
  const nationalityOptions = NATIONALITIES.map(nationality => ({ value: nationality, label: nationality }));

  // Unique vessel names from current crew
  const vesselOptions = useMemo(() => {
    const uniqueVessels = Array.from(new Set(crewMembers.map(crew => crew.vessel)));
    return uniqueVessels.map(vessel => ({ value: vessel, label: vessel }));
  }, [crewMembers]);

  const handleFilterChange = (key: keyof CrewFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleEdit = (crew: any) => {
    setLocation(`/crew/edit/${crew.id}`);
  };

  const handleView = (crew: any) => {
    setLocation(`/crew/view/${crew.id}`);
  };

  const handleDeleteConfirm = async () => {
    if (deleteCrewId) {
      await deleteCrewMutation.mutateAsync(deleteCrewId);
      setDeleteCrewId(null);
    }
  };

  const isFiltered = Object.values(filters).some(value => value && value.length > 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Crew Management</h1>
          <p className="text-muted-foreground">
            Manage crew members and their performance appraisals
          </p>
        </div>
        <Button asChild>
          <Link href="/crew/add">
            <Plus className="w-4 h-4 mr-2" />
            Add Crew Member
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Search & Filters</CardTitle>
            <div className="flex gap-2">
              {isFiltered && (
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.rank || 'all'}
              onValueChange={(value) => handleFilterChange('rank', value === 'all' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by rank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ranks</SelectItem>
                {rankOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.vessel || 'all'}
              onValueChange={(value) => handleFilterChange('vessel', value === 'all' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vesselOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.nationality || 'all'}
              onValueChange={(value) => handleFilterChange('nationality', value === 'all' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by nationality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Nationalities</SelectItem>
                {nationalityOptions.slice(0, 20).map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Crew Members ({enrichedCrewData.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CrewTable
            data={enrichedCrewData}
            loading={crewLoading}
            onEdit={handleEdit}
            onView={handleView}
            onDelete={(crew) => setDeleteCrewId(crew.id)}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCrewId} onOpenChange={() => setDeleteCrewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this crew member? This action cannot be undone.
              All associated appraisals will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}