import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApiV2 } from "./api/adminApiV2";
import { auditActionLabel, auditValueWords, type AccessAuditEntry } from "@shared/v2/admin/accessAuditPresentation";

type AuditPage = { items: Array<AccessAuditEntry & { sentence: string }>; total: number; page: number; pageSize: number };
export function AccessAuditHistory({ roles }: { roles: Array<{ ruid: string; assignedRole: string }> }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all"), [role, setRole] = useState("");
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [search, setSearch] = useState(""), [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timeout = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 250);
    return () => clearTimeout(timeout);
  }, [search]);
  const invalidRange = !!from && !!to && from > to;
  const query = useQuery<AuditPage>({
    queryKey: ["/api/v2/admin/access-control/audit", filter, role, from, to, debouncedSearch, page],
    queryFn: () => adminApiV2.getAccessControlAudit(filter, role || undefined, {
      page: String(page), pageSize: "20", ...(from ? { from } : {}), ...(to ? { to } : {}), search: debouncedSearch,
    }),
    enabled: open && !invalidRange,
  });
  const change = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)} data-testid="button-access-audit-history"><History className="mr-2 h-4 w-4" />Access audit history</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] w-[min(1120px,96vw)] max-w-none overflow-y-auto border-slate-200 bg-[#fbfcfd] p-0">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>Access audit history</DialogTitle>
          <DialogDescription>Who changed access and policy settings. Dates and times are in UTC.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Event filter<select aria-label="Event filter" value={filter} onChange={e => change(setFilter, e.target.value)} className="mt-1 h-10 w-full rounded border bg-white px-2">
              <option value="all">All events</option><option value="management">Management</option><option value="void_completed">Void completed</option><option value="parent_sync">Parent sync</option>
            </select></label>
            <label className="text-sm">Role<select aria-label="Audit role" value={role} onChange={e => change(setRole, e.target.value)} className="mt-1 h-10 w-full rounded border bg-white px-2">
              <option value="">All roles</option>{roles.map(r => <option key={r.ruid} value={r.ruid}>{r.assignedRole}</option>)}
            </select></label>
            <label className="text-sm">From date<input aria-label="From date" type="date" value={from} onChange={e => change(setFrom, e.target.value)} className="mt-1 h-10 w-full rounded border bg-white px-2" /></label>
            <label className="text-sm">To date<input aria-label="To date" type="date" value={to} onChange={e => change(setTo, e.target.value)} className="mt-1 h-10 w-full rounded border bg-white px-2" /></label>
          </div>
          <label className="block text-sm">Search history<input type="search" aria-label="Search history" placeholder="Search people, permissions, roles or settings…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="mt-1 h-10 w-full rounded border bg-white px-3" /></label>
          {invalidRange ? <p role="alert" className="text-sm text-red-700">The end date must be on or after the start date.</p>
            : query.isLoading ? <p role="status" className="py-6 text-sm">Loading audit history…</p>
            : query.isError ? <div role="alert" className="flex items-center justify-between"><p>Could not load audit history. Please try again.</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div>
            : <div className="divide-y rounded-lg border bg-white" data-testid="access-audit-entries">
              {!query.data?.items.length && <p className="p-6 text-sm text-slate-600">No audit events match these filters.</p>}
              {query.data?.items.map(row => <article key={row.id} className="px-4 py-3">
                <p className="text-sm leading-6 text-slate-800" data-testid="audit-sentence">{row.sentence}</p>
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-[#16569e]">Details</summary>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div><dt className="font-semibold">{auditActionLabel(row)} — before</dt><dd className="whitespace-pre-wrap">{auditValueWords(row.before_value, row.event === "grant_change")}</dd></div>
                    <div><dt className="font-semibold">{auditActionLabel(row)} — after</dt><dd className="whitespace-pre-wrap">{auditValueWords(row.after_value, row.event === "grant_change")}</dd></div>
                  </dl>
                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs">{JSON.stringify({
                    auditId: row.id, event: row.event, actor: row.actor, roleId: row.role_id,
                    resource: row.resource, action: row.action, recordedAt: row.recorded_at, details: row.details,
                  }, null, 2)}</pre>
                </details>
              </article>)}
            </div>}
          {!invalidRange && <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span role="status">{query.data?.total ?? 0} entries · Page {page} of {Math.max(1, Math.ceil((query.data?.total ?? 0) / 20))} · 20 per page</span>
            <div className="flex gap-2"><Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" disabled={query.isFetching || page * 20 >= (query.data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button></div>
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
