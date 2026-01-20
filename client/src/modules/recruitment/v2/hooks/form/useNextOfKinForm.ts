import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNextOfKin, useCreateNextOfKin, useUpdateNextOfKin, useDeleteNextOfKin } from "../useProfile";
import { mapNextOfKinToForm, type NextOfKinFormData } from "../../api/mappers";

const nextOfKinFormSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  familyName: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  relationship: z.string().optional(),
});

export function useNextOfKinForm(candidateId: number) {
  const { data: nextOfKin = [], isLoading } = useNextOfKin(candidateId);
  const createMutation = useCreateNextOfKin();
  const updateMutation = useUpdateNextOfKin();
  const deleteMutation = useDeleteNextOfKin();

  const form = useForm<NextOfKinFormData>({
    resolver: zodResolver(nextOfKinFormSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      familyName: "",
      telephone: "",
      email: "",
      address: "",
      relationship: "",
    },
  });

  const onCreate = async (data: NextOfKinFormData) => {
    await createMutation.mutateAsync({
      candidateId,
      data,
    });
    form.reset();
  };

  const onUpdate = async (nokId: number, data: NextOfKinFormData) => {
    await updateMutation.mutateAsync({
      candidateId,
      nokId,
      data,
    });
  };

  const onDelete = async (nokId: number) => {
    await deleteMutation.mutateAsync({
      candidateId,
      nokId,
    });
  };

  return {
    form,
    nextOfKin,
    isLoading,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    onCreate: form.handleSubmit(onCreate),
    onUpdate,
    onDelete,
    mapNextOfKinToForm,
  };
}
