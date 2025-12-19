import { useQuery } from "@tanstack/react-query";

export const useExternalCountries = () => {
  return useQuery({
    queryKey: ['/api/external/countries'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/countries?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch countries: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};
