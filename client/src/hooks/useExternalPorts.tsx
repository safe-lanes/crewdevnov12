import { useQuery } from "@tanstack/react-query";

interface UseExternalPortsOptions {
  enabled?: boolean;
}

export const useExternalPorts = (options?: UseExternalPortsOptions) => {
  return useQuery({
    queryKey: ['/api/external/ports'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/ports?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ports: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
