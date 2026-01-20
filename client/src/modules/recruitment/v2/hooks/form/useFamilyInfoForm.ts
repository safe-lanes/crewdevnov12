import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFamilyInfo, useUpsertFamilyInfo } from "../useProfile";
import { mapFamilyInfoToForm, type FamilyInfoFormData } from "../../api/mappers";
import { useEffect } from "react";

const familyInfoFormSchema = z.object({
  maritalStatus: z.string().optional(),
  numDependentChildren: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  spouseFirstName: z.string().optional(),
  spouseMiddleName: z.string().optional(),
  spouseFamilyName: z.string().optional(),
  spouseDob: z.string().optional(),
});

export function useFamilyInfoForm(candidateId: number) {
  const { data: familyInfo, isLoading } = useFamilyInfo(candidateId);
  const upsertMutation = useUpsertFamilyInfo();

  const form = useForm<FamilyInfoFormData>({
    resolver: zodResolver(familyInfoFormSchema),
    defaultValues: mapFamilyInfoToForm(null),
  });

  useEffect(() => {
    if (familyInfo) {
      form.reset(mapFamilyInfoToForm(familyInfo));
    }
  }, [familyInfo, form]);

  const onSubmit = async (data: FamilyInfoFormData) => {
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
