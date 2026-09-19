import { QueryClient } from "@tanstack/react-query";

// Single shared instance — imported by App.tsx (to provide it) and
// AuthContext.tsx (to clear it on logout, so one crew member's cached
// crew-information never leaks into the next login on the same device).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});
