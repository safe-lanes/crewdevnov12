import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";

interface UseExternalFleetGroupsOptions {
  enabled?: boolean;
}

export const useExternalFleetGroups = (options?: UseExternalFleetGroupsOptions) => {
  return useQuery({
    queryKey: ['/api/external/fleetgroups'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${API_BASE_URL}/crewmasterdata/getallmasterdata/fleetgroups?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch fleetgroups: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
