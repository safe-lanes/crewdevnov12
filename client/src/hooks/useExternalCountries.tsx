import { useQuery } from "@tanstack/react-query";

interface UseExternalCountriesOptions {
  enabled?: boolean;
}

export const useExternalCountries = (options?: UseExternalCountriesOptions) => {
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

      const data = await response.json();
      return data.countries || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
