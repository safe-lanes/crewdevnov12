import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, History, Pencil, Plus, RotateCcw, Trash2, Check, Clock3, LockKeyhole } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getTenantId } from "@/lib/tenantStorage";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Resource = "comments" | "actions";
type PermissionSet = { canview: boolean; cancreate: boolean; canedit: boolean; candelete: boolean };
type Person = { uuid: string; name: string; designation?: string | null };
type Entry = {
  entry_uuid: string;
  crew_uuid: string;
  body?: string;
  author?: Person;
  created_at?: string;
  revision: number;
  edited?: boolean;
  assignee?: Person | null;
  due_date?: string | null;
  status?: "Open" | "Completed";
  overdue?: boolean;
  completed_by?: Person | null;
  completed_at?: string | null;
  closing_note?: string | null;
  removed_by?: Person | null;
  removed_at?: string | null;
  removal_reason?: string | null;
};
type ListResponse = { rows: Entry[]; actorUuid: string; permissions: PermissionSet; timeZone: string };
type HistoryItem = { event_uuid: string; event: string; revision: number; actor: Person; recorded_at: string; snapshot: Entry };
type ModalState =
  | { kind: "edit"; resource: Resource; entry?: Entry }
  | { kind: "view"; resource: Resource; entry: Entry }
  | { kind: "remove"; resource: Resource; entry: Entry }
  | { kind: "transition"; resource: "actions"; entry: Entry; next: "Completed" | "Open" };

const reminder = "Write as if the seafarer may read this. Internal comments can be disclosed if he requests his personal data.";
const emptyPermissions: PermissionSet = { canview: false, cancreate: false, canedit: false, candelete: false };
const sectionLabel: Record<Resource, string> = { comments: "Internal Comments", actions: "Internal Actions" };
const basePath = (crewUuid: string, resource: Resource) => `/api/v2/crew-internal/${encodeURIComponent(crewUuid)}/${resource}`;

function personName(person?: Person | null) {
  if (!person) return "—";
  return [person.name || "Unknown", person.designation].filter(Boolean).join(", ");
}

function formatUtc(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric",
  }).format(date).replaceAll(" ", "-");
}

function errorMessage() {
  return "This record could not be saved. Please review your changes and try again.";
}

function EntryText({ text }: { text?: string }) {
  const value = text || "";
  const short = value.length > 105 ? `${value.slice(0, 102).trimEnd()}…` : value;
  return <span title={value} className="block max-w-[34rem] overflow-hidden text-ellipsis whitespace-nowrap">{short || "—"}</span>;
}

function ActionButton({
  label, onClick, children, disabled = false, tone = "neutral",
}: {
  label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; tone?: "neutral" | "danger" | "success";
}) {
  const colors = tone === "danger"
    ? "text-rose-700 hover:bg-rose-50"
    : tone === "success"
      ? "text-teal-800 hover:bg-teal-50"
      : "text-slate-600 hover:bg-slate-100";
  return (
    <Button type="button" size="icon" variant="ghost" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`h-8 w-8 ${colors}`}>
      {children}
    </Button>
  );
}

export default function CrewInternalRecords({ crewUuid }: { crewUuid: string }) {
  const { userType, userId: signedInUserId, roleId, isLoading: permissionsLoading, canView, canCreate, canEdit, canDelete } = usePermissions();
  const queryClient = useQueryClient();
  // Scope private caches to tenant, actor, role and effective grants. Revoking
  // Delete must not leave removed wording in an already-open details window.
  const userId = JSON.stringify([getTenantId(), signedInUserId, roleId, userType,
    ...["Internal Comments", "Internal Actions"].flatMap(menu => [canView(menu), canCreate(menu), canEdit(menu), canDelete(menu)])]);
  const isOffice = ["office", "sail admin"].includes(userType?.trim().toLowerCase() || "");
  const viewComments = isOffice && canView("Internal Comments");
  const viewActions = isOffice && canView("Internal Actions");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRows, setHistoryRows] = useState<HistoryItem[]>([]);
  const [draftBody, setDraftBody] = useState("");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftReason, setDraftReason] = useState("");
  const [draftClosingNote, setDraftClosingNote] = useState("");
  const [formError, setFormError] = useState("");
  const [mutationBusy, setMutationBusy] = useState(false);
  const previousIdentity = useRef({ crewUuid, userId });

  const commentsKey = useMemo(() => ["/api/v2/crew-internal", crewUuid, userId, "comments"] as const, [crewUuid, userId]);
  const actionsKey = useMemo(() => ["/api/v2/crew-internal", crewUuid, userId, "actions"] as const, [crewUuid, userId]);

  useEffect(() => {
    const previous = previousIdentity.current;
    if (previous.crewUuid !== crewUuid || previous.userId !== userId) {
      queryClient.removeQueries({ queryKey: ["/api/v2/crew-internal", previous.crewUuid, previous.userId] });
      setModal(null);
      setHistoryOpen(false);
      setHistoryRows([]);
      setHistoryError("");
      setHistoryLoading(false);
      setFormError("");
      previousIdentity.current = { crewUuid, userId };
    }
  }, [crewUuid, userId, queryClient]);

  const commentsQuery = useQuery<ListResponse>({
    queryKey: commentsKey,
    gcTime: 0,
    refetchOnWindowFocus: true,
    enabled: !!crewUuid && viewComments && !permissionsLoading,
    queryFn: async () => {
      const response = await apiRequest("GET", basePath(crewUuid, "comments"));
      const payload = await response.json() as ListResponse;
      return {
        ...payload,
        rows: (payload.rows || []).map((row) => {
          if (row.removed_at && !canDelete("Internal Comments")) {
            const safe = { ...row };
            delete safe.body;
            delete safe.author;
            delete safe.created_at;
            delete safe.edited;
            return safe;
          }
          return row;
        }),
      };
    },
  });
  const actionsQuery = useQuery<ListResponse>({
    queryKey: actionsKey,
    gcTime: 0,
    refetchOnWindowFocus: true,
    enabled: !!crewUuid && viewActions && !permissionsLoading,
    queryFn: async () => {
      const response = await apiRequest("GET", basePath(crewUuid, "actions"));
      const payload = await response.json() as ListResponse;
      return {
        ...payload,
        rows: (payload.rows || []).map((row) => {
          if (row.removed_at && !canDelete("Internal Actions")) {
            const safe = { ...row };
            delete safe.body;
            delete safe.author;
            delete safe.created_at;
            delete safe.edited;
            delete safe.assignee;
            delete safe.due_date;
            delete safe.status;
            delete safe.overdue;
            delete safe.completed_by;
            delete safe.completed_at;
            delete safe.closing_note;
            return safe;
          }
          return row;
        }),
      };
    },
  });

  const assigneesQuery = useQuery<Person[]>({
    queryKey: ["/api/v2/crew-internal", crewUuid, userId, "assignees"],
    gcTime: 0,
    enabled: !!crewUuid && viewActions && !permissionsLoading && !!modal && modal.kind === "edit" && modal.resource === "actions",
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/v2/crew-internal/${encodeURIComponent(crewUuid)}/assignees`);
      return await response.json() as Person[];
    },
  });

  const commentsPerms = commentsQuery.data?.permissions || emptyPermissions;
  const actionsPerms = actionsQuery.data?.permissions || emptyPermissions;
  const permitted = (resource: Resource, capability: keyof PermissionSet) => {
    const local = resource === "comments" ? {
      canview: canView("Internal Comments"), cancreate: canCreate("Internal Comments"),
      canedit: canEdit("Internal Comments"), candelete: canDelete("Internal Comments"),
    } : {
      canview: canView("Internal Actions"), cancreate: canCreate("Internal Actions"),
      canedit: canEdit("Internal Actions"), candelete: canDelete("Internal Actions"),
    };
    const server = resource === "comments" ? commentsPerms : actionsPerms;
    return isOffice && local[capability] && (!((resource === "comments" ? commentsQuery.data : actionsQuery.data)) || server[capability]);
  };
  const refresh = (resource: Resource) => queryClient.invalidateQueries({ queryKey: resource === "comments" ? commentsKey : actionsKey });

  const mutation = useMutation({
    mutationFn: async ({ method, url, body }: { method: string; url: string; body: Record<string, unknown> }) => {
      const response = await apiRequest(method, url, body);
      return response.status === 204 ? null : response.json().catch(() => null);
    },
    onMutate: () => { setMutationBusy(true); setFormError(""); },
    onSettled: () => setMutationBusy(false),
  });

  const openEditor = (resource: Resource, entry?: Entry) => {
    setDraftBody(entry?.body || "");
    setDraftAssignee(entry?.assignee?.uuid || "");
    setDraftDueDate(entry?.due_date || "");
    setDraftReason("");
    setDraftClosingNote("");
    setFormError("");
    setModal({ kind: "edit", resource, entry });
  };
  const closeModal = () => { if (!mutationBusy) { setModal(null); setFormError(""); } };
  const saveEntry = async () => {
    if (!modal || modal.kind !== "edit") return;
    const body = draftBody.trim();
    if (!body) { setFormError("Enter a description before saving."); return; }
    const resource = modal.resource;
    const base = basePath(crewUuid, resource);
    const isEdit = !!modal.entry;
    const payload: Record<string, unknown> = resource === "comments"
      ? { body, ...(isEdit ? { revision: modal.entry!.revision } : {}) }
      : { body, assigneeUuid: draftAssignee, dueDate: draftDueDate, ...(isEdit ? { revision: modal.entry!.revision } : {}) };
    if (resource === "actions" && (!draftAssignee || !draftDueDate)) {
      setFormError("Choose an assignee and due date.");
      return;
    }
    try {
      await mutation.mutateAsync({
        method: isEdit ? "PATCH" : "POST",
        url: isEdit ? `${base}/${encodeURIComponent(modal.entry!.entry_uuid)}` : base,
        body: payload,
      });
      setModal(null);
      await refresh(resource);
    } catch {
      setFormError(errorMessage());
    }
  };
  const removeEntry = async () => {
    if (!modal || modal.kind !== "remove") return;
    if (!draftReason.trim()) { setFormError("Enter a reason for removing this record."); return; }
    const resource = modal.resource;
    const item = modal.entry;
    try {
      await mutation.mutateAsync({
        method: "POST",
        url: `${basePath(crewUuid, resource)}/${encodeURIComponent(item.entry_uuid)}/remove`,
        body: { reason: draftReason.trim(), revision: item.revision },
      });
      // Removed wording/history must not remain in any open or cached private view.
      setHistoryRows([]);
      setHistoryOpen(false);
      setModal(null);
      queryClient.removeQueries({ queryKey: ["/api/v2/crew-internal", crewUuid, userId, resource, item.entry_uuid] });
      await refresh(resource);
    } catch {
      setFormError(errorMessage());
    }
  };
  const transition = async () => {
    if (!modal || modal.kind !== "transition") return;
    const { entry, next } = modal;
    try {
      await mutation.mutateAsync({
        method: "POST",
        url: `${basePath(crewUuid, "actions")}/${encodeURIComponent(entry.entry_uuid)}/${next === "Completed" ? "complete" : "reopen"}`,
        body: { revision: entry.revision, ...(next === "Completed" && draftClosingNote.trim() ? { closingNote: draftClosingNote.trim() } : {}) },
      });
      setModal(null);
      await refresh("actions");
    } catch {
      setFormError(errorMessage());
    }
  };

  const openView = (resource: Resource, entry: Entry) => {
    setModal({ kind: "view", resource, entry });
    setHistoryRows([]);
    setHistoryError("");
    setHistoryOpen(false);
  };
  const loadHistory = async (resource: Resource, entry: Entry) => {
    setHistoryError("");
    setHistoryRows([]);
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const response = await apiRequest("GET", `${basePath(crewUuid, resource)}/${encodeURIComponent(entry.entry_uuid)}/history`);
      setHistoryRows(await response.json() as HistoryItem[]);
    } catch {
      setHistoryError("History is unavailable right now. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const identityChanged = previousIdentity.current.crewUuid !== crewUuid || previousIdentity.current.userId !== userId;
  if (!isOffice || permissionsLoading || identityChanged || (!viewComments && !viewActions)) return null;

  const renderError = (query: typeof commentsQuery) => {
    if (!query.isError) return null;
    return <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span>These records could not be loaded.</span>
      <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()} className="border-rose-300 bg-transparent text-rose-800">Try again</Button>
    </div>;
  };

  const renderRows = (resource: Resource, rows: Entry[], data: ListResponse | undefined) => {
    const perms: PermissionSet = {
      canview: permitted(resource, "canview"),
      cancreate: permitted(resource, "cancreate"),
      canedit: permitted(resource, "canedit"),
      candelete: permitted(resource, "candelete"),
    };
    if (rows.length === 0) return <div className="px-5 py-9 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf1f2] text-[#345f68]"><LockKeyhole className="h-4 w-4" /></div>
      <p className="text-sm font-medium text-[#283d45]">Nothing recorded yet</p>
      <p className="mt-1 text-xs text-slate-500">New confidential records will appear here.</p>
    </div>;
    return (
      <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[750px] border-collapse text-left text-xs">
            <thead className="bg-[#f2f5f5] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5a6b70]">
              <tr>
                <th className="px-4 py-3">Raised by</th><th className="px-4 py-3">Date added</th>
                <th className="px-4 py-3">{resource === "comments" ? "Description" : "Action"}</th>
                {resource === "actions" && <><th className="px-4 py-3">Assigned to</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3">Status</th></>}
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7eded]">
              {rows.map((entry) => entry.removed_at ? (
                <tr key={entry.entry_uuid} className="bg-[#fafbfa] text-slate-500">
                  <td colSpan={resource === "comments" ? 4 : 7} className="px-4 py-3">
                    <span className="font-medium text-slate-700">{resource === "comments" ? "Comment" : "Action"} removed by </span>
                    {personName(entry.removed_by)}
                    {" on "}
                    {formatUtc(entry.removed_at)}
                    {entry.removal_reason && <> — reason: {entry.removal_reason}</>}
                    {perms.candelete && <ActionButton label="View removed record and history" onClick={() => openView(resource, entry)}><Eye className="h-4 w-4" /></ActionButton>}
                  </td>
                </tr>
              ) : (
                <tr key={entry.entry_uuid} className="text-[#34464b] hover:bg-[#f9fbfa]">
                  <td className="whitespace-nowrap px-4 py-3">{personName(entry.author)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatUtc(entry.created_at)}{entry.edited && <span className="ml-1.5 rounded bg-[#edf2f1] px-1.5 py-0.5 text-[10px] text-[#66777b]">edited</span>}</td>
                  <td className="px-4 py-3"><EntryText text={entry.body} /></td>
                  {resource === "actions" && <>
                    <td className="px-4 py-3">{personName(entry.assignee)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatUtc(entry.due_date)}</td>
                    <td className="px-4 py-3"><StatusTag entry={entry} /></td>
                  </>}
                  <td className="px-3 py-2"><EntryActions resource={resource} entry={entry} perms={perms} actorUuid={data?.actorUuid} onView={() => openView(resource, entry)} onEdit={() => openEditor(resource, entry)} onRemove={() => { setDraftReason(""); setFormError(""); setModal({ kind: "remove", resource, entry }); }} onTransition={(next) => { setDraftClosingNote(""); setFormError(""); setModal({ kind: "transition", resource: "actions", entry, next }); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-[#e7eded] md:hidden">
          {rows.map((entry) => entry.removed_at ? (
            <div key={entry.entry_uuid} className="flex items-center justify-between gap-2 bg-[#fafbfa] px-4 py-3 text-xs text-slate-600">
              <span><strong className="text-slate-700">Removed</strong> · {personName(entry.removed_by)} · {formatUtc(entry.removed_at)}{entry.removal_reason ? ` · ${entry.removal_reason}` : ""}</span>
              {perms.candelete && <ActionButton label="View removed record and history" onClick={() => openView(resource, entry)}><Eye className="h-4 w-4" /></ActionButton>}
            </div>
          ) : (
            <article key={entry.entry_uuid} className="space-y-3 px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-sm font-semibold text-[#263c43]">{resource === "comments" ? "Comment" : "Action"}</p><p className="mt-1 text-xs text-slate-500">{personName(entry.author)} · {formatUtc(entry.created_at)} {entry.edited && "· edited"}</p></div>
                {resource === "actions" && <StatusTag entry={entry} />}
              </div>
              <p className="text-sm leading-5 text-[#44565a]">{entry.body}</p>
              {resource === "actions" && <div className="grid grid-cols-2 gap-2 rounded-md bg-[#f4f7f6] p-3 text-xs"><div><span className="block text-slate-500">Assigned to</span><span className="mt-1 block font-medium text-slate-700">{personName(entry.assignee)}</span></div><div><span className="block text-slate-500">Due date</span><span className="mt-1 block font-medium text-slate-700">{formatUtc(entry.due_date)}</span></div></div>}
              <div className="flex justify-end"><EntryActions resource={resource} entry={entry} perms={perms} actorUuid={data?.actorUuid} onView={() => openView(resource, entry)} onEdit={() => openEditor(resource, entry)} onRemove={() => { setDraftReason(""); setFormError(""); setModal({ kind: "remove", resource, entry }); }} onTransition={(next) => { setDraftClosingNote(""); setFormError(""); setModal({ kind: "transition", resource: "actions", entry, next }); }} /></div>
            </article>
          ))}
        </div>
      </>
    );
  };

  const renderSection = (resource: Resource) => {
    const query = resource === "comments" ? commentsQuery : actionsQuery;
    const data = query.data;
    const rows = data?.rows || [];
    const title = resource === "comments" ? "H1. Comments" : "H2. Actions";
    return (
      <section data-testid={`internal-${resource}`} className="overflow-hidden rounded-xl border border-[#dce5e4] bg-[#fffefd] shadow-[0_2px_12px_rgba(40,65,69,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eeee] px-4 py-3 sm:px-5">
          <div><h2 className="text-sm font-semibold tracking-[0.01em] text-[#28424a]">{title}</h2>
            {resource === "actions" && <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 className="h-3 w-3" />Overdue is calculated against the current UTC calendar date.</p>}
          </div>
          {permitted(resource, "cancreate") && <Button type="button" size="sm" onClick={() => openEditor(resource)} className="h-8 gap-1.5 bg-[#315e68] px-3 text-xs text-white hover:bg-[#264b54]"><Plus className="h-3.5 w-3.5" />Add</Button>}
        </div>
        {query.isLoading ? <div className="space-y-3 p-5" aria-label={`Loading ${title}`}><div className="h-3 w-1/4 animate-pulse rounded bg-[#e9eeee]" /><div className="h-8 animate-pulse rounded bg-[#f0f4f3]" /><div className="h-8 animate-pulse rounded bg-[#f0f4f3]" /></div>
          : query.isError ? <div className="p-4">{renderError(query)}</div>
            : renderRows(resource, rows, data)}
      </section>
    );
  };

  const activeEntry = modal && "entry" in modal ? modal.entry : undefined;

  return (
    <div data-testid="crew-internal-records" className="space-y-5 rounded-2xl border border-[#d6e1e0] bg-[#f7f8f5] p-3 sm:p-5">
      <header className="border-b border-[#cbd9d7] pb-3">
        <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dce9e7] text-xs font-bold text-[#315e68]">H</span><h1 className="text-base font-semibold tracking-tight text-[#29444b] sm:text-lg">Part H — Internal Comments</h1></div>
        <p className="mt-2 pl-9 text-xs leading-5 text-[#657579]">Recorded by authorised office users. Not visible to vessel users or the seafarer.</p>
      </header>
      {viewComments && renderSection("comments")}
      {viewActions && renderSection("actions")}

      <Dialog open={!!modal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-[#d8e2e0] bg-[#fffefd] sm:max-w-xl">
          {modal?.kind === "edit" && <>
            <DialogHeader><DialogTitle className="text-[#28424a]">{modal.entry ? "Edit" : "Add"} {modal.resource === "comments" ? "comment" : "action"}</DialogTitle><DialogDescription>Confidential crew record. Changes are recorded in its history.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-[#e2c995] bg-[#fbf5e8] px-3.5 py-3 text-xs leading-5 text-[#705627]">{reminder}</div>
              <div className="space-y-2"><Label htmlFor="internal-record-body">{modal.resource === "comments" ? "Comment" : "Action description"}</Label><Textarea id="internal-record-body" autoFocus value={draftBody} onChange={(event) => setDraftBody(event.target.value)} rows={5} maxLength={10000} className="resize-y border-[#cedbd9] bg-white" /></div>
              {modal.resource === "actions" && <>
                <div className="space-y-2"><Label htmlFor="internal-assignee">Assigned to</Label>
                  <select id="internal-assignee" value={draftAssignee} onChange={(event) => setDraftAssignee(event.target.value)} className="h-10 w-full rounded-md border border-[#cedbd9] bg-white px-3 text-sm text-[#34464b] focus:outline-none focus:ring-2 focus:ring-[#8aa9a8]">
                    <option value="">Choose an office user</option>
                    {(assigneesQuery.data || []).map((person) => <option key={person.uuid} value={person.uuid}>{personName(person)}</option>)}
                  </select>
                  {assigneesQuery.isLoading && <p className="text-xs text-slate-500">Loading eligible office users…</p>}
                  {assigneesQuery.isError && <p role="alert" className="text-xs text-rose-700">Eligible office users could not be loaded.</p>}
                  {assigneesQuery.data?.length === 0 && <p className="text-xs text-slate-500">No eligible office users are available.</p>}
                </div>
                <div className="space-y-2"><Label htmlFor="internal-due-date">Due date</Label><Input id="internal-due-date" type="date" value={draftDueDate} onChange={(event) => setDraftDueDate(event.target.value)} className="border-[#cedbd9] bg-white" /></div>
              </>}
              {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeModal} disabled={mutationBusy}>Cancel</Button><Button type="button" onClick={() => void saveEntry()} disabled={mutationBusy || (modal.resource === "actions" && assigneesQuery.isLoading)} className="bg-[#315e68] text-white hover:bg-[#264b54]">{mutationBusy ? "Saving…" : "Save record"}</Button></DialogFooter>
          </>}
          {modal?.kind === "view" && activeEntry && <>
            <DialogHeader><DialogTitle className="text-[#28424a]">{modal.resource === "comments" ? "Comment record" : "Action record"}</DialogTitle><DialogDescription>Confidential record details and audit history.</DialogDescription></DialogHeader>
            {activeEntry.removed_at && <div className="rounded-lg border border-[#e4d9c7] bg-[#f8f4ed] p-3 text-sm text-[#695b47]">
              <p className="font-semibold">Removed record</p><p className="mt-1 text-xs">Removed by {personName(activeEntry.removed_by)} · {formatUtc(activeEntry.removed_at)}</p>{activeEntry.removal_reason && <p className="mt-2 text-sm">Reason: {activeEntry.removal_reason}</p>}
            </div>}
            <div className="rounded-lg border border-[#e2e9e8] bg-[#f8faf9] p-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#34484d]">{activeEntry.body || "Record text is unavailable."}</p>
              <p className="mt-4 text-xs text-slate-500">Raised by {personName(activeEntry.author)} · {formatUtc(activeEntry.created_at)}{activeEntry.edited ? " · edited" : ""}</p>
              {modal.resource === "actions" && <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#e2e9e8] pt-3 text-xs"><div><span className="text-slate-500">Assigned to</span><p className="mt-1 text-slate-700">{personName(activeEntry.assignee)}</p></div><div><span className="text-slate-500">Due date</span><p className="mt-1 text-slate-700">{formatUtc(activeEntry.due_date)}</p></div><div><span className="text-slate-500">Status</span><p className="mt-1 text-slate-700">{activeEntry.status || "—"}{activeEntry.overdue && activeEntry.status === "Open" ? " · Overdue" : ""}</p></div>{activeEntry.completed_at && <div><span className="text-slate-500">Completed</span><p className="mt-1 text-slate-700">{personName(activeEntry.completed_by)} · {formatUtc(activeEntry.completed_at)}</p></div>}{activeEntry.closing_note && <div className="col-span-2"><span className="text-slate-500">Closing note</span><p className="mt-1 whitespace-pre-wrap text-slate-700">{activeEntry.closing_note}</p></div>}</div>}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="gap-2" onClick={() => void loadHistory(modal.resource, activeEntry)}><History className="h-4 w-4" />View history</Button>
              <Button type="button" variant="outline" onClick={closeModal}>Close</Button>
            </DialogFooter>
          </>}
          {modal?.kind === "remove" && <>
            <DialogHeader><DialogTitle className="text-[#28424a]">Remove {modal.resource === "comments" ? "comment" : "action"}?</DialogTitle><DialogDescription>The record will remain as a collapsed audit line. Removal cannot be undone here.</DialogDescription></DialogHeader>
            <div className="space-y-2"><Label htmlFor="internal-removal-reason">Reason for removal</Label><Textarea id="internal-removal-reason" autoFocus value={draftReason} onChange={(event) => setDraftReason(event.target.value)} rows={3} maxLength={2000} className="border-[#cedbd9] bg-white" /></div>
            {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={closeModal} disabled={mutationBusy}>Cancel</Button><Button type="button" onClick={() => void removeEntry()} disabled={mutationBusy} className="bg-rose-700 text-white hover:bg-rose-800">{mutationBusy ? "Removing…" : "Remove record"}</Button></DialogFooter>
          </>}
          {modal?.kind === "transition" && <>
            <DialogHeader><DialogTitle className="text-[#28424a]">{modal.next === "Completed" ? "Complete action" : "Reopen action"}</DialogTitle><DialogDescription>{modal.next === "Completed" ? "This records who completed the action and when." : "This action will return to Open."}</DialogDescription></DialogHeader>
            {modal.next === "Completed" && <div className="space-y-2"><Label htmlFor="internal-closing-note">Closing note <span className="font-normal text-slate-500">(optional)</span></Label><Textarea id="internal-closing-note" autoFocus value={draftClosingNote} onChange={(event) => setDraftClosingNote(event.target.value)} rows={3} maxLength={2000} className="border-[#cedbd9] bg-white" /></div>}
            {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={closeModal} disabled={mutationBusy}>Cancel</Button><Button type="button" onClick={() => void transition()} disabled={mutationBusy} className="bg-[#315e68] text-white hover:bg-[#264b54]">{mutationBusy ? "Saving…" : modal.next === "Completed" ? "Complete action" : "Reopen action"}</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={(open) => { setHistoryOpen(open); if (!open) setHistoryRows([]); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-[#d8e2e0] bg-[#fffefd] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-[#28424a]">Record history</DialogTitle><DialogDescription>Earlier revisions and lifecycle events for this confidential record.</DialogDescription></DialogHeader>
          {historyError ? <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">{historyError}</p>
            : historyLoading ? <p className="py-6 text-center text-sm text-slate-500">Loading history…</p>
            : historyRows.length ? <ol className="space-y-3">{historyRows.map((item) => <li key={item.event_uuid} className="rounded-lg border border-[#e2e9e8] bg-[#f8faf9] p-3">
              <div className="flex flex-wrap justify-between gap-1 text-xs"><span className="font-semibold capitalize text-[#34535a]">{item.event.replace(/_/g, " ")}</span><span className="text-slate-500">Revision {item.revision} · {formatUtc(item.recorded_at)}</span></div>
              <p className="mt-1 text-xs text-slate-500">{personName(item.actor)}</p>
              {item.snapshot?.body && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-5 text-[#405358]">{item.snapshot.body}</p>}
              {item.snapshot?.assignee && <p className="mt-2 text-xs text-slate-600">Assigned to {personName(item.snapshot.assignee)}{item.snapshot.due_date ? ` · Due ${formatUtc(item.snapshot.due_date)}` : ""}</p>}
              {item.snapshot?.closing_note && <p className="mt-2 text-xs text-slate-600">Closing note: {item.snapshot.closing_note}</p>}
            </li>)}</ol>
              : <p className="py-6 text-center text-sm text-slate-500">No history is available.</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => { setHistoryOpen(false); setHistoryRows([]); }}>Close history</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusTag({ entry }: { entry: Entry }) {
  if (entry.status === "Completed") return <span className="inline-flex whitespace-nowrap rounded-full bg-[#e7f1ed] px-2 py-1 text-[10px] font-semibold text-[#356451]">Completed</span>;
  if (entry.overdue) return <span className="inline-flex whitespace-nowrap rounded-full bg-[#f8eee5] px-2 py-1 text-[10px] font-semibold text-[#93552f]">Overdue</span>;
  return <span className="inline-flex whitespace-nowrap rounded-full bg-[#edf2f1] px-2 py-1 text-[10px] font-semibold text-[#5d6d70]">Open</span>;
}

function EntryActions({
  resource, entry, perms, actorUuid, onView, onEdit, onRemove, onTransition,
}: {
  resource: Resource; entry: Entry; perms: PermissionSet; actorUuid?: string;
  onView: () => void; onEdit: () => void; onRemove: () => void; onTransition: (next: "Completed" | "Open") => void;
}) {
  const canTransition = resource === "actions" && (actorUuid === entry.author?.uuid || actorUuid === entry.assignee?.uuid);
  const canEditEntry = perms.canedit && (resource === "actions" || actorUuid === entry.author?.uuid);
  return <div className="flex items-center justify-end gap-0.5">
    <ActionButton label="View record" onClick={onView}><Eye className="h-4 w-4" /></ActionButton>
    {canEditEntry && <ActionButton label={`Edit ${resource === "comments" ? "comment" : "action"}`} onClick={onEdit}><Pencil className="h-4 w-4" /></ActionButton>}
    {resource === "actions" && canTransition && <ActionButton label={entry.status === "Completed" ? "Reopen action" : "Complete action"} tone={entry.status === "Completed" ? "neutral" : "success"} onClick={() => onTransition(entry.status === "Completed" ? "Open" : "Completed")}>{entry.status === "Completed" ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}</ActionButton>}
    {perms.candelete && <ActionButton label="Remove record" tone="danger" onClick={onRemove}><Trash2 className="h-4 w-4" /></ActionButton>}
  </div>;
}
