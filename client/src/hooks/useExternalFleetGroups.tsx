import { useQuery } from "@tanstack/react-query";

export const useExternalFleetGroups = () => {
  return useQuery({
    queryKey: ['/api/external/fleetgroups'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/fleetgroups?domain=${domain}`,
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
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};