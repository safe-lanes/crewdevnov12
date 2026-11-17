/**
 * Admin → Approval Workflow.
 *
 * Left: every flow connected to the approval engine, read live from the engine's registry
 * (GET /api/v2/approval-engine/registry). A new card shows up here automatically.
 * Right: the engine's chain builder for the selected flow (vendored ApprovalEngineAdmin):
 * classification → steps → roles, plus the on/off switch for the flow.
 *
 * Editing needs Access Control EDIT on "Approval Workflow"; the server enforces it too.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Mail, Search, Workflow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/contexts/PermissionsContext";
import ApprovalEngineAdmin from "../../../../server/v2/approval-engine/client/ApprovalEngineAdmin";

const ENGINE_BASE = "/api/v2/approval-engine";
const MENU_NAME = "Approval Workflow";

type RegistryScope = { screenId: string; actionId: string; label: string; classifications: { id: string; label: string }[] };
type RegistryModule = { moduleId: string; label: string; scopes: RegistryScope[] };
type ConfigStatus = { emailsEnabled: boolean; emailChannel: "ses" | "ses-test" | "legacy" };
type Selected = { moduleId: string; screenId: string; actionId: string; label: string };

function emailStatusText(s: ConfigStatus | null): string | null {
  if (!s) return null;
  if (!s.emailsEnabled) return "Approval emails are switched off on this server.";
  if (s.emailChannel === "ses") return "Approval emails are sent through Amazon SES.";
  if (s.emailChannel === "ses-test") return "Approval emails are in test mode: they are logged, not sent.";
  return "Approval emails use the standard Crewing email service.";
}

export default function ApprovalWorkflowPage(): JSX.Element {
  const { canEdit } = usePermissions();
  const readOnly = !canEdit(MENU_NAME);

  const [modules, setModules] = useState<RegistryModule[] | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${ENGINE_BASE}/registry`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ modules: RegistryModule[] }>;
      })
      .then((tree) => {
        if (cancelled) return;
        setModules(tree.modules ?? []);
        setExpanded(new Set((tree.modules ?? []).map((m) => m.moduleId)));
      })
      .catch((e: Error) => { if (!cancelled) setLoadError(`Could not load the approval flows (${e.message}).`); });
    fetch("/api/v2/approvals/config-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!modules) return [];
    if (!q) return modules;
    return modules
      .map((m) => ({ ...m, scopes: m.scopes.filter((s) => s.label.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)) }))
      .filter((m) => m.scopes.length > 0);
  }, [modules, search]);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const emailText = emailStatusText(status);

  return (
    <div data-testid="page-approval-workflow">
      <div className="mb-4">
        <h1 className="font-bold text-black text-2xl" data-testid="text-approval-workflow-title">Approval Workflow</h1>
        <p className="text-sm text-gray-600 mt-1">
          Choose a flow, then set who approves it: one or more steps, each by role.
          {readOnly ? " You can view the chains; editing needs the Approval Workflow edit permission." : ""}
        </p>
        {emailText && (
          <p className="text-sm text-gray-700 mt-2 flex items-center gap-2" data-testid="text-approval-email-status">
            <Mail size={14} className="text-gray-500" /> {emailText}
          </p>
        )}
      </div>

      <div className="flex gap-4 items-start">
        <div className="w-80 shrink-0 border border-gray-200 rounded-lg bg-white" data-testid="panel-approval-workflow-tree">
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search flows" className="pl-9 h-9 bg-white" data-testid="input-approval-workflow-search" />
            </div>
          </div>
          <div className="p-2">
            {loadError && <p className="text-sm text-red-700 p-2">{loadError}</p>}
            {!loadError && modules === null && <p className="text-sm text-gray-500 p-2">Loading…</p>}
            {!loadError && modules !== null && modules.length === 0 && (
              <p className="text-sm text-gray-600 p-2" data-testid="text-approval-workflow-empty">
                No Crewing flow is connected to the approval engine yet.
              </p>
            )}
            {visible.map((m) => (
              <div key={m.moduleId}>
                <button type="button" onClick={() => toggle(m.moduleId)} className="w-full flex items-center gap-2 px-2 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 rounded" data-testid={`button-approval-module-${m.moduleId}`}>
                  {expanded.has(m.moduleId) || search ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Workflow size={16} className="text-gray-500" />
                  {m.label}
                </button>
                {(expanded.has(m.moduleId) || search) && m.scopes.map((s) => {
                  const isSel = selected?.moduleId === m.moduleId && selected.screenId === s.screenId && selected.actionId === s.actionId;
                  return (
                    <button
                      key={`${s.screenId}/${s.actionId}`}
                      type="button"
                      onClick={() => setSelected({ moduleId: m.moduleId, screenId: s.screenId, actionId: s.actionId, label: `${m.label} — ${s.label}` })}
                      className={`w-full text-left pl-10 pr-2 py-2 text-sm rounded ${isSel ? "bg-blue-50 text-blue-900 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                      data-testid={`button-approval-scope-${m.moduleId}-${s.screenId}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 border border-gray-200 rounded-lg bg-white" data-testid="panel-approval-workflow-detail">
          {selected ? (
            <div>
              <div className="px-4 pt-4 font-semibold text-gray-900">{selected.label}</div>
              <ApprovalEngineAdmin
                key={`${selected.moduleId}/${selected.screenId}/${selected.actionId}`}
                basePath={ENGINE_BASE}
                scope={{ moduleId: selected.moduleId, screenId: selected.screenId, actionId: selected.actionId }}
                readOnly={readOnly}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-600 p-6">Select a flow on the left to see or set its approval chain.</p>
          )}
        </div>
      </div>
    </div>
  );
}
