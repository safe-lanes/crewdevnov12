import { useQuery } from "@tanstack/react-query";

export const useExternalVessels = () => {
  return useQuery({
    queryKey: ['/api/external/vessels'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/vessels?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch vessels: ${response.status}`);
      }

      const data = await response.json();
      // Extract vessels array from wrapper object { success: true, vessels: [...] }
      // Note: Vessel names are in the 'vessel' field, ID is in 'vuid'
      return data.vessels || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};