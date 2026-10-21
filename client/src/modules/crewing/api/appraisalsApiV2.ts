import { apiRequest } from "@/lib/queryClient";

const V2_BASE = "/api/v2/appraisals";

export const appraisalsApiV2 = {
  getAll: () => fetch(`${V2_BASE}`).then(r => r.json()),
  getById: (appraisalUuid: string) => fetch(`${V2_BASE}/${appraisalUuid}`).then(r => r.json()),
  getByCrewMember: (crewMemberId: string) => fetch(`${V2_BASE}/crew/${crewMemberId}`).then(r => r.json()),
  getPromotionRecommendations: (crewMemberId: string, rank: string) =>
    fetch(`${V2_BASE}/crew/${crewMemberId}/promotion-recommendations?rank=${encodeURIComponent(rank)}`).then(r => r.json()),
  create: (data: any) => apiRequest("POST", V2_BASE, data),
  update: (appraisalUuid: string, data: any) => apiRequest("PUT", `${V2_BASE}/${appraisalUuid}`, data),
  delete: (appraisalUuid: string) => apiRequest("DELETE", `${V2_BASE}/${appraisalUuid}`),
  submitStage1: (appraisalUuid: string, data: any) => apiRequest("POST", `${V2_BASE}/${appraisalUuid}/submit-stage1`, data),
  submitStage2: (appraisalUuid: string, data: any) => apiRequest("POST", `${V2_BASE}/${appraisalUuid}/submit-stage2`, data),
  submitStage3: (appraisalUuid: string, data: any) => apiRequest("POST", `${V2_BASE}/${appraisalUuid}/submit-stage3`, data),
};
