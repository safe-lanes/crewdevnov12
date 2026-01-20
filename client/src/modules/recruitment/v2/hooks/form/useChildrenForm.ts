import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChildren, useCreateChild, useUpdateChild, useDeleteChild } from "../useProfile";
import { mapChildToForm, type ChildFormData } from "../../api/mappers";

const childFormSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  familyName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
});

export function useChildrenForm(candidateId: number) {
  const { data: children = [], isLoading } = useChildren(candidateId);
  const createMutation = useCreateChild();
  const updateMutation = useUpdateChild();
  const deleteMutation = useDeleteChild();

  const form = useForm<ChildFormData>({
    resolver: zodResolver(childFormSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      familyName: "",
      dob: "",
      gender: "",
    },
  });

  const onCreate = async (data: ChildFormData) => {
    await createMutation.mutateAsync({
      candidateId,
      data,
    });
    form.reset();
  };

  const onUpdate = async (childId: number, data: ChildFormData) => {
    await updateMutation.mutateAsync({
      candidateId,
      childId,
      data,
    });
  };

  const onDelete = async (childId: number) => {
    await deleteMutation.mutateAsync({
      candidateId,
      childId,
    });
  };

  return {
    form,
    children,
    isLoading,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    onCreate: form.handleSubmit(onCreate),
    onUpdate,
    onDelete,
    mapChildToForm,
  };
}
