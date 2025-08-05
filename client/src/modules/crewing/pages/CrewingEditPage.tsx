/**
 * Edit existing crew member page
 */

import React from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CrewForm } from "../components/CrewForm";
import { useCrewMember, useUpdateCrewMember } from "../hooks/useCrew";
import { CrewMemberFormData } from "../validation/crew.schema";

export function CrewingEditPage() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  
  const { data: crewMember, isLoading, error } = useCrewMember(id || '');
  const updateCrewMutation = useUpdateCrewMember();

  const handleSubmit = async (data: CrewMemberFormData) => {
    if (id) {
      try {
        await updateCrewMutation.mutateAsync({ id, data });
        setLocation('/'); // Navigate back to crew list
      } catch (error) {
        // Error is handled by the hook's onError callback
        console.error('Failed to update crew member:', error);
      }
    }
  };

  const handleCancel = () => {
    setLocation('/');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading crew member details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !crewMember) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Crew Member Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The requested crew member could not be found.
            </p>
            <Button onClick={() => setLocation('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Crew List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => setLocation('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Crew List
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Crew Member</h1>
          <p className="text-muted-foreground">
            Update details for {crewMember.firstName} {crewMember.lastName}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <CrewForm
          title="Edit Crew Member"
          initialData={crewMember}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateCrewMutation.isPending}
        />
      </div>
    </div>
  );
}