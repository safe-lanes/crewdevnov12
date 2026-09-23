import { apiRequest } from '@/lib/queryClient';

const BASE = '/api/v2/crew-app-review';

export interface CrewPortalPendingChange {
  pendingUuid: string;
  domain: string;
  crewUuid: string;
  section: string;
  action: 'create' | 'update' | 'delete';
  targetUuid: string | null;
  payload: string;
  stagedAttachments: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedByUuid: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  previousValues?: Record<string, unknown> | null;
  resolvedNames?: Record<string, string>;
}

export const crewPortalSubmissionsApi = {
  async listPending(status: string = 'pending'): Promise<CrewPortalPendingChange[]> {
    const res = await apiRequest('GET', `${BASE}/pending?status=${encodeURIComponent(status)}`);
    return res.json();
  },
  async approve(pendingUuid: string): Promise<unknown> {
    const res = await apiRequest('POST', `${BASE}/${pendingUuid}/approve`);
    return res.json();
  },
  async reject(pendingUuid: string, reason: string): Promise<unknown> {
    const res = await apiRequest('POST', `${BASE}/${pendingUuid}/reject`, { reason });
    return res.json();
  },
};
