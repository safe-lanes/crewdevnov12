import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";
import { getResolvedDomain } from "@/lib/encryptionService";

interface UseExternalNationalitiesOptions {
  enabled?: boolean;
}

export const useExternalNationalities = (options?: UseExternalNationalitiesOptions) => {
  return useQuery({
    queryKey: ['/api/external/nationalities'],
    queryFn: async () => {
      const domain = getResolvedDomain();
      const response = await fetch(
        `${API_BASE_URL}/crewmasterdata/getallmasterdata/nationalities?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch nationalities: ${response.status}`);
      }

      const data = await response.json();
      return data.nationalities || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
