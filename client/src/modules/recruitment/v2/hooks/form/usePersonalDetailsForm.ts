import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePersonalDetails, useUpsertPersonalDetails } from "../useProfile";
import { mapPersonalDetailsToForm, type PersonalDetailsFormData } from "../../api/mappers";
import { useEffect } from "react";

const personalDetailsFormSchema = z.object({
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
  placeOfBirthCity: z.string().optional(),
  placeOfBirthCountryUuid: z.string().optional(),
  ageInYears: z.string().optional(),
  nativeLanguageUuid: z.string().optional(),
  foreignLanguages: z.string().optional(),
  englishProficiency: z.string().optional(),
  manningAgent: z.string().optional(),
});

export function usePersonalDetailsForm(candidateId: number) {
  const { data: personalDetails, isLoading } = usePersonalDetails(candidateId);
  const upsertMutation = useUpsertPersonalDetails();

  const form = useForm<PersonalDetailsFormData>({
    resolver: zodResolver(personalDetailsFormSchema),
    defaultValues: mapPersonalDetailsToForm(null),
  });

  useEffect(() => {
    if (personalDetails) {
      form.reset(mapPersonalDetailsToForm(personalDetails));
    }
  }, [personalDetails, form]);

  const onSubmit = async (data: PersonalDetailsFormData) => {
    await upsertMutation.mutateAsync({
      candidateId,
      data,
    });
  };

  return {
    form,
    isLoading,
    isSaving: upsertMutation.isPending,
    onSubmit: form.handleSubmit(onSubmit),
    isDirty: form.formState.isDirty,
  };
}
