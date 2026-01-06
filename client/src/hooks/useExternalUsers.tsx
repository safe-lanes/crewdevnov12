import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api";

export interface ExternalUser {
  uuid: string;
  userName: string;
  role: string;
  designation: string;
  userType: string;
  department: string;
  email: string;
}

interface UseExternalUsersOptions {
  enabled?: boolean;
}

export const useExternalUsers = (options?: UseExternalUsersOptions) => {
  return useQuery({
    queryKey: ['/api/external/users'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${API_BASE_URL}/crewmasterdata/getallmasterdata/users?domain=${domain}`,
        {
          method: 'GET',
          headers: { 'accept': '*/*' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const data = await response.json();
      return data.users || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
