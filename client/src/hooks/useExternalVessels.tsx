import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";

interface UseExternalVesselsOptions {
  enabled?: boolean;
}

export const useExternalVessels = (options?: UseExternalVesselsOptions) => {
  return useQuery({
    queryKey: ['/api/external/vessels'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${API_BASE_URL}/crewmasterdata/getallmasterdata/vessels?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch vessels: ${response.status}`);
      }

      const data = await response.json();
      return data.vessels || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
