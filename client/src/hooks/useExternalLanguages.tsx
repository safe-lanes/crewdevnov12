import { useQuery } from "@tanstack/react-query";

interface UseExternalLanguagesOptions {
  enabled?: boolean;
}

export const useExternalLanguages = (options?: UseExternalLanguagesOptions) => {
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
      return data.languages || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
