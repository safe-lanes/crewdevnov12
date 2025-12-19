import { useQuery } from "@tanstack/react-query";

export const useExternalNationalities = () => {
  return useQuery({
    queryKey: ['/api/external/nationalities'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/nationalities?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch nationalities: ${response.status}`);
      }

      const data = await response.json();
      // Extract nationalities array from wrapper object { success: true, nationalities: [...] }
      return data.nationalities || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};
