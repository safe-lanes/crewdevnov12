/**
 * Reusable crew member form component
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/form/TextField";
import { SelectField } from "@/components/form/SelectField";
import { DateField } from "@/components/form/DateField";
import { crewMemberSchema, CrewMemberFormData } from "../validation/crew.schema";
import { ALL_RANKS, VESSEL_TYPES } from "@/utils/data/ranks";
import { NATIONALITIES } from "@/utils/data/nationalities";
import { CrewMember } from "../types/crew.types";
import { Loader2, Save, X } from "lucide-react";

interface CrewFormProps {
  initialData?: Partial<CrewMember>;
  onSubmit: (data: CrewMemberFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  title?: string;
}

export function CrewForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  title = "Crew Member Details"
}: CrewFormProps) {
  const form = useForm<CrewMemberFormData>({
    resolver: zodResolver(crewMemberSchema),
    defaultValues: {
      id: initialData?.id || "",
      firstName: initialData?.firstName || "",
      middleName: initialData?.middleName || "",
      lastName: initialData?.lastName || "",
      rank: initialData?.rank || "",
      nationality: initialData?.nationality || "",
      vessel: initialData?.vessel || "",
      vesselType: initialData?.vesselType || "",
      signOnDate: initialData?.signOnDate || "",
    },
  });

  const handleSubmit = (data: CrewMemberFormData) => {
    onSubmit(data);
  };

  const rankOptions = ALL_RANKS.map(rank => ({
    value: rank,
    label: rank,
  }));

  const vesselTypeOptions = VESSEL_TYPES.map(type => ({
    value: type,
    label: type,
  }));

  const nationalityOptions = NATIONALITIES.map(nationality => ({
    value: nationality,
    label: nationality,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                control={form.control}
                name="id"
                label="Crew ID"
                placeholder="Enter crew ID"
                required
                disabled={!!initialData?.id}
                description={initialData?.id ? "Crew ID cannot be changed" : undefined}
              />
              
              <SelectField
                control={form.control}
                name="rank"
                label="Rank"
                placeholder="Select rank"
                options={rankOptions}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField
                control={form.control}
                name="firstName"
                label="First Name"
                placeholder="Enter first name"
                required
              />
              
              <TextField
                control={form.control}
                name="middleName"
                label="Middle Name"
                placeholder="Enter middle name (optional)"
              />
              
              <TextField
                control={form.control}
                name="lastName"
                label="Last Name"
                placeholder="Enter last name"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                control={form.control}
                name="nationality"
                label="Nationality"
                placeholder="Select nationality"
                options={nationalityOptions}
                required
              />
              
              <DateField
                control={form.control}
                name="signOnDate"
                label="Sign-On Date"
                required
                max={new Date().toISOString().split('T')[0]}
                description="Date when crew member joined the vessel"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                control={form.control}
                name="vessel"
                label="Vessel Name"
                placeholder="Enter vessel name"
                required
              />
              
              <SelectField
                control={form.control}
                name="vesselType"
                label="Vessel Type"
                placeholder="Select vessel type"
                options={vesselTypeOptions}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {initialData?.id ? "Update" : "Create"} Crew Member
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}