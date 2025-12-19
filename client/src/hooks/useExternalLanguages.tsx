import { useQuery } from "@tanstack/react-query";

export const useExternalLanguages = () => {
  return useQuery({
    queryKey: ['/api/external/languages'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/languages?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch languages: ${response.status}`);
      }

      const data = await response.json();
      // Extract languages array from wrapper object { success: true, languages: [...] }
      // Note: Language names are in the 'languageName' field
      return data.languages || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};