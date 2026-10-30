import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { COMPANY_FORM_PERMISSIONS, emptyCompanyFormGrants, type CompanyFormGrants } from "@shared/v2/admin/companyFormPermissions";

const ACTION_HELP: Record<(typeof COMPANY_FORM_PERMISSIONS)[number]["action"], string> = {
  view: "Allows this role to view Company Forms.",
  fill_in: "Allows this role to fill in Company Forms.",
  witness: "Records a seafarer’s signature on their behalf, with the acting user’s own identity recorded as the witness.",
  sign_representative: "Allows an office user to sign a Company Form in the company representative role.",
  void: "Allows this role to void a Company Form that has not been completed.",
  void_completed: "Allows this role to void a Company Form that has already been completed.",
  override_checklist: "Allows this role to override unresolved mandatory or failed/pending checklist checks. It does not allow overriding unfinished required forms.",
};

function ActionHelp({ action, label }: { action: keyof typeof ACTION_HELP; label: string }) {
  const helpId = `company-form-help-${action}`;
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Help: ${label}`}
              onClick={event => event.stopPropagation()}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#16569e] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16569e]"
            >
              <Info aria-hidden="true" className="h-4 w-4" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm leading-5">{ACTION_HELP[action]}</TooltipContent>
      </Tooltip>
      <PopoverContent id={helpId} side="top" className="w-72 text-sm leading-5">
        {ACTION_HELP[action]}
      </PopoverContent>
    </Popover>
  );
}

export function CompanyFormsPermissionEditor({ roleId }: { roleId: string }) {
  const url = `/api/v2/admin/access-control/roles/${encodeURIComponent(roleId)}/action-permissions`;
  const client = useQueryClient();
  const query = useQuery<{ grants: CompanyFormGrants }>({
    queryKey: [url], queryFn: async () => (await apiRequest("GET", url)).json(),
  });
  const [grants, setGrants] = useState(emptyCompanyFormGrants);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.data) { setGrants(query.data.grants); setDirty(false); }
  }, [query.data]);
  async function save() {
    setSaving(true); setError("");
    try {
      await apiRequest("PUT", url, { grants });
      await client.invalidateQueries({ queryKey: [url] });
      await client.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/my-permissions"] });
      await client.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/state"] });
      await client.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/audit"] });
      setDirty(false);
    } catch { setError("Unable to save Company Forms permissions. Please retry."); }
    finally { setSaving(false); }
  }
  return <section className="overflow-hidden rounded-lg border border-gray-200 bg-white" data-testid="company-forms-permissions">
    <div className="border-b border-gray-200 bg-[#16569e] px-4 py-3 text-white">
      <h2 className="font-semibold">Company Forms</h2>
    </div>
    <div className="p-4">
      <p className="mb-3 text-sm text-gray-600">Choose whether this role can view and fill in forms, witness seafarer signatures, sign for the company, void unfinished or completed forms, or override eligible checklist blocks. Users can act only within their Office or Vessel category and the vessels they may access; signing for the company is limited to office roles.</p>
      {query.isLoading ? <div className="space-y-3" aria-label="Loading Company Forms permissions">
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-gray-100" />
      </div> : query.isError ? <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">Unable to load Company Forms permissions. <button className="underline" onClick={() => query.refetch()}>Retry</button></div> :
        <TooltipProvider delayDuration={250}>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {COMPANY_FORM_PERMISSIONS.map(({ action, label }) => {
              const controlId = `company-form-grant-${action}`;
              return <div key={action} className="flex min-w-0 items-center gap-2 rounded-md border border-gray-100 bg-gray-50/70 px-3 py-2">
                <Checkbox id={controlId} checked={grants[action]} disabled={saving} data-testid={`company-form-grant-${action}`}
                  onCheckedChange={value => { setGrants(prev => ({ ...prev, [action]: value === true })); setDirty(true); }} />
                <label htmlFor={controlId} className="min-w-0 flex-1 cursor-pointer text-sm text-gray-800">{label}</label>
                <ActionHelp action={action} label={label} />
              </div>;
            })}
          </div>
        </TooltipProvider>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <Button className="mt-3" disabled={!dirty || saving || !query.data} onClick={save}
        data-testid="save-company-form-permissions">{saving ? "Saving…" : "Save Company Forms permissions"}</Button>
    </div>
  </section>;
}
