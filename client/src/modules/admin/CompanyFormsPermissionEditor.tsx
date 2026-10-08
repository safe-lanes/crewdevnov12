import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { COMPANY_FORM_PERMISSIONS, emptyCompanyFormGrants, type CompanyFormGrants } from "@shared/v2/admin/companyFormPermissions";

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
      setDirty(false);
    } catch { setError("Unable to save Company Forms permissions. Please retry."); }
    finally { setSaving(false); }
  }
  return <section className="p-4 border-b" data-testid="company-forms-permissions">
    <h3 className="font-semibold mb-2">Company Forms</h3>
    <p className="text-sm text-muted-foreground mb-3">Independent operational permissions. Category and vessel restrictions still apply.</p>
    {query.isLoading ? <p>Loading permissions…</p> : query.isError ? <p role="alert">Unable to load Company Forms permissions.</p> :
      <div className="flex flex-wrap gap-5">{COMPANY_FORM_PERMISSIONS.map(({ action, label }) =>
        <label key={action} className="flex gap-2 items-center text-sm">
          <Checkbox checked={grants[action]} disabled={saving} data-testid={`company-form-grant-${action}`}
            onCheckedChange={value => { setGrants(prev => ({ ...prev, [action]: value === true })); setDirty(true); }} />
          {label}
        </label>)}</div>}
    {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
    <Button className="mt-3" disabled={!dirty || saving || !query.data} onClick={save}
      data-testid="save-company-form-permissions">{saving ? "Saving…" : "Save Company Forms permissions"}</Button>
  </section>;
}
