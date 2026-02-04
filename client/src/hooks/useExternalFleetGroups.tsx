import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";

interface UseExternalFleetGroupsOptions {
  enabled?: boolean;
}

export const useExternalFleetGroups = (options?: UseExternalFleetGroupsOptions) => {
  return useQuery({
    queryKey: ['/api/v2/recruitment/fleet-groups'],
    queryFn: async () => {
      // Primary: fetch from local database
      try {
        const localResponse = await fetch('/api/v2/recruitment/fleet-groups', {
          method: 'GET',
          headers: { 'accept': 'application/json' }
        });

        if (localResponse.ok) {
          const data = await localResponse.json();
          if (data.fleetGroups && data.fleetGroups.length > 0) {
            return data;
          }
        }
      } catch (localError) {
        console.warn('Local fleet groups fetch failed, trying external API:', localError);
      }

      // Fallback: fetch from external API
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
