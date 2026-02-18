import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAddress, useUpsertAddress } from "../useProfile";
import { mapAddressToForm, type AddressFormData } from "../../api/mappers";
import { useEffect } from "react";

const addressFormSchema = z.object({
  countryOfResidenceUuid: z.string().optional(),
  nearestAirport: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  contactLandline: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export function useAddressForm(candidateId: number) {
  const { data: address, isLoading } = useAddress(candidateId);
  const upsertMutation = useUpsertAddress();

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: mapAddressToForm(null),
  });

  useEffect(() => {
    if (address) {
      form.reset(mapAddressToForm(address));
    }
  }, [address, form]);

  const onSubmit = async (data: AddressFormData) => {
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
