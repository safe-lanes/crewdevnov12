import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";

interface UseExternalVesselTypesOptions {
  enabled?: boolean;
}

export const useExternalVesselTypes = (options?: UseExternalVesselTypesOptions) => {
  return useQuery({
    queryKey: ['/api/external/vessel-types'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';

      const response = await fetch(
        `${API_BASE_URL}/crewmasterdata/getallmasterdata/vesseltypes?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch vessel types: ${response.status}`);
      }

      const data = await response.json();
      return data.vesseltypes || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
