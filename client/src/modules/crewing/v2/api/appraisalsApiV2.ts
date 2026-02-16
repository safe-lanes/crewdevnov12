import { apiRequest } from "@/lib/queryClient";

const V2_BASE = "/api/v2/appraisals";

export const appraisalsApiV2 = {
  getAll: () => fetch(`${V2_BASE}`).then(r => r.json()),
  getById: (id: number) => fetch(`${V2_BASE}/${id}`).then(r => r.json()),
  getByCrewMember: (crewMemberId: string) => fetch(`${V2_BASE}/crew/${crewMemberId}`).then(r => r.json()),
  getPromotionRecommendations: (crewMemberId: string, rank: string) =>
    fetch(`${V2_BASE}/crew/${crewMemberId}/promotion-recommendations?rank=${encodeURIComponent(rank)}`).then(r => r.json()),
  create: (data: any) => apiRequest("POST", V2_BASE, data),
  update: (id: number, data: any) => apiRequest("PUT", `${V2_BASE}/${id}`, data),
  delete: (id: number) => apiRequest("DELETE", `${V2_BASE}/${id}`),
  submitStage1: (id: number, data: any) => apiRequest("POST", `${V2_BASE}/${id}/submit-stage1`, data),
  submitStage2: (id: number, data: any) => apiRequest("POST", `${V2_BASE}/${id}/submit-stage2`, data),
  submitStage3: (id: number, data: any) => apiRequest("POST", `${V2_BASE}/${id}/submit-stage3`, data),
};
