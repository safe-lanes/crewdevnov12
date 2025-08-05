/**
 * Add new crew member page
 */

import React from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrewForm } from "../components/CrewForm";
import { useCreateCrewMember } from "../hooks/useCrew";
import { CrewMemberFormData } from "../validation/crew.schema";

export function CrewingAddPage() {
  const [, setLocation] = useLocation();
  const createCrewMutation = useCreateCrewMember();

  const handleSubmit = async (data: CrewMemberFormData) => {
    try {
      await createCrewMutation.mutateAsync(data);
      setLocation('/'); // Navigate back to crew list
    } catch (error) {
      // Error is handled by the hook's onError callback
      console.error('Failed to create crew member:', error);
    }
  };

  const handleCancel = () => {
    setLocation('/');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => setLocation('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Crew List
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Crew Member</h1>
          <p className="text-muted-foreground">
            Enter the details for the new crew member
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <CrewForm
          title="New Crew Member"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={createCrewMutation.isPending}
        />
      </div>
    </div>
  );
}