/**
 * Approval chain progress for one record, plus "can the signed-in user decide now?".
 *
 *   const chain = useApprovalChain({ moduleId, screenId, subjectRef });
 *   <ApprovalChainProgress chain={chain} />
 *   chain.canDecide → show the Approve / Reject buttons
 *
 * FAIL-SOFT BY DESIGN: no chain configured, engine not mounted, or any fetch error →
 * { hasChain: false }, and the screen behaves exactly as it did before approvals existed.
 */
import { useQuery } from "@tanstack/react-query";

const ENGINE_BASE = "/api/v2/approval-engine";

type SlotStatus = "pending" | "active" | "approved" | "rejected" | "superseded";
interface SlotView {
  nodeKey: string;
  slotOrdinal: number;
  roleId: string;
  roleLabel: string;
  status: SlotStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  remarks: string | null;
}
interface NodeView { key: string; type: string; label: string; ordinal: number; quorum?: { rule: string; n?: number } }
interface RequestView {
  requuid: string;
  status: "pending" | "approved" | "returned" | "withdrawn";
  currentNodeKey: string | null;
  submittedAt: string;
  snapshot: { nodes: NodeView[] };
  slots: SlotView[];
}

export interface ApprovalChainState {
  loading: boolean;
  /** A request exists for this record (pending or finished). */
  hasChain: boolean;
  request: RequestView | null;
  /** The signed-in user is an approver of the step that is active now. */
  canDecide: boolean;
}

export function useApprovalChain(args: { moduleId: string; screenId: string; actionId?: string; subjectRef: string | null | undefined }): ApprovalChainState {
  const { moduleId, screenId, actionId = "", subjectRef } = args;
  const enabled = !!subjectRef;
  const q = useQuery({
    queryKey: ["approval-chain", moduleId, screenId, actionId, subjectRef],
    enabled,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({ moduleId, screenId, actionId, subjectRef: subjectRef ?? "" });
      const [statusRes, pendingRes] = await Promise.all([
        fetch(`${ENGINE_BASE}/requests/status?${params.toString()}`),
        fetch(`${ENGINE_BASE}/pending`),
      ]);
      if (!statusRes.ok) return { request: null as RequestView | null, myPending: [] as string[] };
      const requests = (await statusRes.json()) as RequestView[];
      const pending = pendingRes.ok ? ((await pendingRes.json()) as Array<{ requuid: string }>) : [];
      return { request: requests[0] ?? null, myPending: pending.map((p) => p.requuid) };
    },
  });
  if (!enabled || q.isError) return { loading: false, hasChain: false, request: null, canDecide: false };
  const request = q.data?.request ?? null;
  return {
    loading: q.isLoading,
    hasChain: !!request,
    request,
    canDecide: !!request && request.status === "pending" && (q.data?.myPending ?? []).includes(request.requuid),
  };
}

function stepState(request: RequestView, node: NodeView): "done" | "active" | "waiting" | "rejected" {
  const slots = request.slots.filter((s) => s.nodeKey === node.key);
  if (slots.some((s) => s.status === "rejected")) return "rejected";
  if (request.currentNodeKey === node.key && request.status === "pending") return "active";
  if (slots.length > 0 && slots.every((s) => s.status === "approved" || s.status === "superseded")) return "done";
  return "waiting";
}

const REQUEST_STATUS_TEXT: Record<RequestView["status"], string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  returned: "Returned",
  withdrawn: "Withdrawn",
};

export function ApprovalChainProgress({ chain }: { chain: ApprovalChainState }): JSX.Element | null {
  if (!chain.hasChain || !chain.request) return null;
  const request = chain.request;
  const steps = request.snapshot.nodes.filter((n) => n.type === "approval-step").sort((a, b) => a.ordinal - b.ordinal);
  const activeIndex = steps.findIndex((s) => s.key === request.currentNodeKey);
  const active = activeIndex >= 0 ? steps[activeIndex] : null;
  const activeRoles = active ? request.slots.filter((s) => s.nodeKey === active.key && s.status === "active").map((s) => s.roleLabel) : [];

  return (
    <div className="border border-gray-200 rounded-md p-3 bg-white text-sm" data-testid="approval-chain-progress">
      <div className="font-semibold text-gray-900">{REQUEST_STATUS_TEXT[request.status]}</div>
      {request.status === "pending" && active && (
        <div className="text-gray-700 mt-1" data-testid="text-approval-chain-active">
          Step {activeIndex + 1} of {steps.length}: waiting for {activeRoles.join(", ") || active.label}
        </div>
      )}
      <ol className="mt-2 space-y-1">
        {steps.map((node, i) => {
          const state = stepState(request, node);
          const color = state === "done" ? "text-green-700" : state === "active" ? "text-blue-700" : state === "rejected" ? "text-red-700" : "text-gray-500";
          const label = state === "done" ? "Approved" : state === "active" ? "In progress" : state === "rejected" ? "Rejected" : "Not started";
          const remarks = request.slots.filter((s) => s.nodeKey === node.key && s.remarks).map((s) => s.remarks as string);
          return (
            <li key={node.key} className={color}>
              {i + 1}. {node.label || `Step ${i + 1}`} — {label}
              {remarks.length > 0 && <span className="text-gray-600"> ({remarks.join("; ")})</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
