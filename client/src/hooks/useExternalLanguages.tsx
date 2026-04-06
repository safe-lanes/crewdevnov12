import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";
import { getResolvedDomain } from "@/lib/encryptionService";

interface UseExternalLanguagesOptions {
  enabled?: boolean;
}

export const useExternalLanguages = (options?: UseExternalLanguagesOptions) => {
  return useQuery({
    queryKey: ['/api/external/languages'],
    queryFn: async () => {
      const domain = getResolvedDomain();
      const response = await fetch(
        `${API_BASE_URL}/crewmasterdata/getallmasterdata/languages?domain=${domain}`,
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
