import { apiRequest } from "@/lib/queryClient";

export const ACCOUNTS_BASE = "/api/v2/accounts";

/** Structured view of an apiRequest error string (`"<status>: <body>"`). */
export interface ApiErrorInfo {
  status: number | null;
  message: string;
  data: any;
}

/** Parse the `"<status>: <json|text>"` error thrown by apiRequest. */
export function parseApiError(err: unknown): ApiErrorInfo {
  const raw = err instanceof Error ? err.message : String(err);
  const match = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!match) return { status: null, message: raw, data: null };
  const status = parseInt(match[1], 10);
  let data: any = null;
  try {
    data = JSON.parse(match[2]);
  } catch {
    /* body was not JSON */
  }
  return { status, message: (data && data.error) || match[2] || raw, data };
}

async function req<T = any>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await apiRequest(method, url, body);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const accountsApiV2 = {
  config: {
    update: (data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/config`, data),
  },
  payElements: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/pay-elements`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/pay-elements/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/pay-elements/${uuid}`),
    seedStandard: () =>
      req("POST", `${ACCOUNTS_BASE}/pay-elements/seed-standard`),
  },
  wageScales: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/wage-scales`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/wage-scales/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/wage-scales/${uuid}`),
    replaceLines: (uuid: string, lines: unknown[]) =>
      req("PUT", `${ACCOUNTS_BASE}/wage-scales/${uuid}/lines`, { lines }),
    activate: (uuid: string, acknowledge?: boolean) =>
      req("POST", `${ACCOUNTS_BASE}/wage-scales/${uuid}/activate`, {
        acknowledge,
      }),
    supersede: (uuid: string, effectiveTo?: string) =>
      req("POST", `${ACCOUNTS_BASE}/wage-scales/${uuid}/supersede`, {
        effectiveTo,
      }),
  },
  cbaReference: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/cba-reference`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PUT", `${ACCOUNTS_BASE}/cba-reference/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/cba-reference/${uuid}`),
  },
  engagements: {
    sync: (vesselUuid: string, period: string) =>
      req("POST", `${ACCOUNTS_BASE}/engagements/sync`, { vesselUuid, period }),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PATCH", `${ACCOUNTS_BASE}/engagements/${uuid}`, data),
    setTimingOverride: (
      uuid: string,
      payElementUuid: string,
      paymentTimingOverride: string | null,
    ) =>
      req("POST", `${ACCOUNTS_BASE}/engagements/${uuid}/timing-override`, {
        payElementUuid,
        paymentTimingOverride,
      }),
  },
  calc: {
    run: (vesselUuid: string, period: string) =>
      req("POST", `${ACCOUNTS_BASE}/calc/run`, { vesselUuid, period }),
  },
  portage: {
    submit: (
      uuid: string,
      approvers: { approverId?: string | null; approver: string }[],
    ) => req("POST", `${ACCOUNTS_BASE}/portage/${uuid}/submit`, { approvers }),
    decide: (
      approvalUuid: string,
      decision: "Approved" | "Rejected",
      comments?: string | null,
    ) =>
      req("POST", `${ACCOUNTS_BASE}/portage/approvals/${approvalUuid}/decision`, {
        decision,
        comments,
      }),
  },
  settlements: {
    compute: (engagementUuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/settlements/compute`, { engagementUuid }),
    recompute: (uuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/settlements/${uuid}/recompute`),
    addAdjustment: (uuid: string, data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/settlements/${uuid}/adjustments`, data),
    updateAdjustment: (adjustmentUuid: string, data: Record<string, unknown>) =>
      req(
        "PATCH",
        `${ACCOUNTS_BASE}/settlements/adjustments/${adjustmentUuid}`,
        data,
      ),
    deleteAdjustment: (adjustmentUuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/settlements/adjustments/${adjustmentUuid}`),
    submit: (
      uuid: string,
      approvers: { approverId?: string | null; approver: string }[],
    ) => req("POST", `${ACCOUNTS_BASE}/settlements/${uuid}/submit`, { approvers }),
    decide: (
      approvalUuid: string,
      decision: "Approved" | "Rejected",
      comments?: string | null,
    ) =>
      req(
        "POST",
        `${ACCOUNTS_BASE}/settlements/approvals/${approvalUuid}/decision`,
        { decision, comments },
      ),
    markPaid: (uuid: string, paidDate: string, paymentReference?: string | null) =>
      req("POST", `${ACCOUNTS_BASE}/settlements/${uuid}/mark-paid`, {
        paidDate,
        paymentReference,
      }),
    lock: (uuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/settlements/${uuid}/lock`),
    revertToDraft: (uuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/settlements/${uuid}/revert-to-draft`),
  },
  monthlyTransactions: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/monthly-transactions`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PATCH", `${ACCOUNTS_BASE}/monthly-transactions/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/monthly-transactions/${uuid}`),
    accept: (uuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/monthly-transactions/${uuid}/accept`),
    reject: (uuid: string, reviewComment: string) =>
      req("POST", `${ACCOUNTS_BASE}/monthly-transactions/${uuid}/reject`, {
        reviewComment,
      }),
  },
  vesselPortage: {
    submit: (vesselUuid: string, period: string) =>
      req(
        "POST",
        `${ACCOUNTS_BASE}/vessel-portage/${vesselUuid}/${period}/submit`,
      ),
    returnToVessel: (portageUuid: string, comment: string) =>
      req("POST", `${ACCOUNTS_BASE}/vessel-portage/${portageUuid}/return`, {
        comment,
      }),
  },
  allotments: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/allotments`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PATCH", `${ACCOUNTS_BASE}/allotments/${uuid}`, data),
    suspend: (uuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/allotments/${uuid}/suspend`),
    reactivate: (uuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/allotments/${uuid}/reactivate`),
    end: (uuid: string, validTo?: string) =>
      req("POST", `${ACCOUNTS_BASE}/allotments/${uuid}/end`, { validTo }),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/allotments/${uuid}`),
  },
  advances: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/advances`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PATCH", `${ACCOUNTS_BASE}/advances/${uuid}`, data),
    cancel: (uuid: string) =>
      req("POST", `${ACCOUNTS_BASE}/advances/${uuid}/cancel`),
    close: (uuid: string, remark: string) =>
      req("POST", `${ACCOUNTS_BASE}/advances/${uuid}/close`, { remark }),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/advances/${uuid}`),
  },
  bondItems: {
    create: (data: Record<string, unknown>) =>
      req("POST", `${ACCOUNTS_BASE}/bond-items`, data),
    update: (uuid: string, data: Record<string, unknown>) =>
      req("PATCH", `${ACCOUNTS_BASE}/bond-items/${uuid}`, data),
    remove: (uuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/bond-items/${uuid}`),
  },
  ctm: {
    updateHeader: (
      vesselUuid: string,
      period: string,
      data: Record<string, unknown>,
    ) => req("PUT", `${ACCOUNTS_BASE}/ctm/${vesselUuid}/${period}`, data),
    createLine: (
      vesselUuid: string,
      period: string,
      data: Record<string, unknown>,
    ) =>
      req("POST", `${ACCOUNTS_BASE}/ctm/${vesselUuid}/${period}/lines`, data),
    updateLine: (lineUuid: string, data: Record<string, unknown>) =>
      req("PATCH", `${ACCOUNTS_BASE}/ctm/lines/${lineUuid}`, data),
    removeLine: (lineUuid: string) =>
      req("DELETE", `${ACCOUNTS_BASE}/ctm/lines/${lineUuid}`),
  },
};
