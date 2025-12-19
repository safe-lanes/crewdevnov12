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

      const data = await response.json();
      // Extract countries array from wrapper object { success: true, countries: [...] }
      // Note: Country names are in the 'countryName' field
      return data.countries || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};
