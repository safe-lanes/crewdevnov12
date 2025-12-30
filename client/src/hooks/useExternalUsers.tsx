import { useQuery } from "@tanstack/react-query";

export interface ExternalUser {
  uuid: string;
  userName: string;
  role: string;
  designation: string;
  userType: string;
  department: string;
  email: string;
}

export const useExternalUsers = () => {
  return useQuery({
    queryKey: ['/api/external/users'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      // TODO: Replace with actual SAIL Audits API endpoint when provided
      const response = await fetch(
        `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/users?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const data = await response.json();
      // Extract users array from wrapper object { success: true, users: [...] }
      // Note: Field mapping may need adjustment based on actual API response
      return data.users || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};
