import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewPortalSubmissionsApi } from '../api/crewPortalSubmissionsApi';

const QUERY_KEY = (status: string) => ['crew-app-review', 'pending', status];

export function useCrewPortalSubmissions(status: string = 'pending') {
  return useQuery({
    queryKey: QUERY_KEY(status),
    queryFn: () => crewPortalSubmissionsApi.listPending(status),
  });
}

export function useApproveCrewPortalSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pendingUuid: string) => crewPortalSubmissionsApi.approve(pendingUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-app-review'] });
      // The now-published record is live in the canonical crew-pool tables —
      // refresh the crew database grid/detail views so it shows up there too.
      // Matches V2_QUERY_KEY in ./useCrewPoolV2.ts.
      queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool', 'crew'] });
    },
  });
}

export function useRejectCrewPortalSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pendingUuid, reason }: { pendingUuid: string; reason: string }) =>
      crewPortalSubmissionsApi.reject(pendingUuid, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-app-review'] });
    },
  });
}
