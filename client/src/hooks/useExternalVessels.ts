import { useQuery, UseQueryResult } from '@tanstack/react-query';

/**
 * External Vessel data structure from SAIL ERP API
 */
export interface ExternalVessel {
  id: string | number;
  name: string;
  vesselType?: string;
  imoNumber?: string;
  flag?: string;
  grossTonnage?: number;
  deadWeight?: number;
  yearBuilt?: number;
  status?: string;
  [key: string]: unknown;
}

/**
 * API response type for external vessels endpoint
 */
export type ExternalVesselsResponse = ExternalVessel[];

/**
 * Configuration options for the useExternalVessels hook
 */
export interface UseExternalVesselsOptions {
  enabled?: boolean;
  domain?: string;
}

const EXTERNAL_VESSELS_API_URL = 'https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/vessels';

/**
 * Fetches vessel data from external SAIL ERP API
 * 
 * NOTE: This uses a custom queryFn because the external API:
 * 1. Is on a different origin (https://dev.sl-sail.com)
 * 2. Requires different headers (no credentials for cross-origin)
 * 3. Has a dynamic domain parameter for authentication
 * 
 * The default queryFn in queryClient.ts is for internal /api/* endpoints
 * and uses credentials: "include" which is not suitable for external APIs.
 * 
 * @param url - The full URL with domain parameter
 * @returns Promise with array of vessels
 */
async function fetchExternalVessels(url: string): Promise<ExternalVesselsResponse> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch vessels: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * React Query hook to fetch vessel data from external SAIL ERP API
 * 
 * @description
 * Fetches vessel master data from the external SAIL ERP API endpoint.
 * Uses domain from localStorage (fallback: 'rsms') for API authentication.
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { data: vessels, isLoading, error } = useExternalVessels();
 * 
 * // With custom domain
 * const { data: vessels } = useExternalVessels({ domain: 'custom-domain' });
 * 
 * // Conditional fetching
 * const { data: vessels } = useExternalVessels({ enabled: isReady });
 * ```
 * 
 * @param options - Optional configuration for the hook
 * @param options.enabled - Whether to auto-fetch on mount (default: true)
 * @param options.domain - Override domain (default: localStorage.domain || 'rsms')
 * 
 * @returns React Query result with vessel data
 */
export function useExternalVessels(
  options: UseExternalVesselsOptions = {}
): UseQueryResult<ExternalVesselsResponse, Error> {
  const { enabled = true, domain: customDomain } = options;

  const domain = customDomain || 
    (typeof window !== 'undefined' ? localStorage.getItem('domain') : null) || 
    'rsms';

  const fullUrl = `${EXTERNAL_VESSELS_API_URL}?domain=${encodeURIComponent(domain)}`;

  return useQuery<ExternalVesselsResponse, Error>({
    queryKey: ['external-vessels', fullUrl],
    queryFn: () => fetchExternalVessels(fullUrl),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled,
  });
}

/**
 * Get the current domain being used for API calls
 * @returns The domain string
 */
export function getExternalVesselsDomain(): string {
  return (typeof window !== 'undefined' ? localStorage.getItem('domain') : null) || 'rsms';
}

export default useExternalVessels;
