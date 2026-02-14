import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

const V2_BASE = '/api/v2/promotions';

export function usePromotionReviewsV2() {
  return useQuery({
    queryKey: [V2_BASE, 'reviews'],
    queryFn: async () => {
      const res = await fetch(`${V2_BASE}/reviews`);
      if (!res.ok) throw new Error('Failed to fetch promotion reviews');
      return res.json();
    },
  });
}

export function usePromotionReviewByUuidV2(reviewUuid: string | undefined) {
  return useQuery({
    queryKey: [V2_BASE, 'reviews', reviewUuid],
    queryFn: async () => {
      const res = await fetch(`${V2_BASE}/reviews/by-uuid/${reviewUuid}`);
      if (!res.ok) throw new Error('Failed to fetch promotion review');
      return res.json();
    },
    enabled: !!reviewUuid,
  });
}

export function usePromotionReviewByIdV2(id: number | undefined) {
  return useQuery({
    queryKey: [V2_BASE, 'reviews', 'by-id', id],
    queryFn: async () => {
      const res = await fetch(`${V2_BASE}/reviews/by-id/${id}`);
      if (!res.ok) throw new Error('Failed to fetch promotion review');
      return res.json();
    },
    enabled: id !== undefined,
  });
}

export function usePromotionReviewsByCrewV2(crewMemberId: string | undefined) {
  return useQuery({
    queryKey: [V2_BASE, 'reviews', 'crew', crewMemberId],
    queryFn: async () => {
      const res = await fetch(`${V2_BASE}/reviews/crew/${crewMemberId}`);
      if (!res.ok) throw new Error('Failed to fetch promotion reviews');
      return res.json();
    },
    enabled: !!crewMemberId,
  });
}

export function usePromotionReviewByCrewAndRankV2(crewMemberId: string | undefined, promotionToRank: string | undefined) {
  return useQuery({
    queryKey: [V2_BASE, 'reviews', 'crew', crewMemberId, 'rank', promotionToRank],
    queryFn: async () => {
      const res = await fetch(`${V2_BASE}/reviews/crew/${crewMemberId}/rank/${encodeURIComponent(promotionToRank!)}`);
      if (!res.ok) throw new Error('Failed to fetch promotion review');
      return res.json();
    },
    enabled: !!crewMemberId && !!promotionToRank,
  });
}

export function useCriteriaMasterV2() {
  return useQuery({
    queryKey: [V2_BASE, 'criteria-master'],
    queryFn: async () => {
      const res = await fetch(`${V2_BASE}/criteria-master`);
      if (!res.ok) throw new Error('Failed to fetch criteria master');
      return res.json();
    },
  });
}

export function useCreatePromotionReviewV2() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `${V2_BASE}/reviews`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_BASE, 'reviews'] });
    },
  });
}

export function useUpdatePromotionReviewV2() {
  return useMutation({
    mutationFn: async ({ reviewUuid, data }: { reviewUuid: string; data: any }) => {
      const res = await apiRequest('PATCH', `${V2_BASE}/reviews/${reviewUuid}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [V2_BASE, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: [V2_BASE, 'reviews', variables.reviewUuid] });
    },
  });
}

export function useDeletePromotionReviewV2() {
  return useMutation({
    mutationFn: async (reviewUuid: string) => {
      const res = await apiRequest('DELETE', `${V2_BASE}/reviews/${reviewUuid}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [V2_BASE, 'reviews'] });
    },
  });
}
