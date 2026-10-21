import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function TrainingComplianceRolePermissionEditor({ roleUuid }: { roleUuid: string }) {
  const url = `/api/v2/admin/access-control/roles/${encodeURIComponent(roleUuid)}/training-compliance`;
  const client = useQueryClient();
  const query = useQuery<{ allowed: boolean }>({ queryKey: [url], queryFn: async () => (await apiRequest("GET", url)).json() });
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (query.data) setAllowed(query.data.allowed); }, [query.data]);
  async function save() {
    setSaving(true); setError("");
    try {
      await apiRequest("PUT", url, { allowed });
      await Promise.all([
        client.invalidateQueries({ queryKey: [url] }),
        client.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/audit"] }),
        client.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/my-permissions"] }),
        client.invalidateQueries({ queryKey: ["/api/v2/admin/training-compliance/my-permission"] }),
      ]);
    } catch { setError("Unable to save training compliance permission. Please retry."); }
    finally { setSaving(false); }
  }
  return <section className="border-b border-gray-200 p-4" data-testid="training-compliance-role-permission">
    <h3 className="mb-2 font-semibold text-gray-800">Training compliance</h3>
    <p className="mb-3 text-sm text-gray-600">Grant this role permission to override training compliance when the server allows it. New grants are off by default.</p>
    {query.isLoading ? <div className="h-5 w-48 animate-pulse rounded bg-gray-100" aria-label="Loading training compliance permission" /> :
      query.isError ? <p className="text-sm text-red-700" role="alert">Unable to load training compliance permission. <button className="underline" onClick={() => query.refetch()}>Retry</button></p> :
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <Checkbox checked={allowed} disabled={saving} onCheckedChange={value => setAllowed(value === true)} data-testid="training-compliance-permission-checkbox" />
          Override training compliance
        </label>}
    {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
    <Button className="mt-3" disabled={!query.data || query.isLoading || saving || allowed === query.data?.allowed} onClick={save} data-testid="save-training-compliance-permission">{saving ? "Saving…" : "Save training compliance permission"}</Button>
  </section>;
}

export function TrainingCompliancePolicySetting() {
  const { data, isLoading, isError, refetch } = useQuery<{
    blockExpiringDuringContract: boolean;
    blockMissingExpiry: boolean;
  }>({
    queryKey: ["/api/v2/admin/training-compliance/settings"],
    queryFn: async () => (await apiRequest("GET", "/api/v2/admin/training-compliance/settings")).json(),
  });
  const client = useQueryClient();
  const [blockExpiringDuringContract, setBlockExpiringDuringContract] = useState(false);
  const [blockMissingExpiry, setBlockMissingExpiry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (data) {
      setBlockExpiringDuringContract(data.blockExpiringDuringContract === true);
      setBlockMissingExpiry(data.blockMissingExpiry === true);
    }
  }, [data]);
  async function save() {
    setSaving(true); setError("");
    try {
      await apiRequest("PUT", "/api/v2/admin/training-compliance/settings", {
        blockExpiringDuringContract,
        blockMissingExpiry,
      });
      await client.invalidateQueries({ queryKey: ["/api/v2/admin/training-compliance/settings"] });
      await client.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/audit"] });
    } catch { setError("Unable to save the training policy. Please retry."); }
    finally { setSaving(false); }
  }
  return <section className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white" data-testid="training-compliance-policy">
    <div className="border-b border-gray-200 bg-[#16569e] px-4 py-3 text-white"><h2 className="font-semibold">Training compliance policy</h2></div>
    <div className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-[240px] flex-1">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Block mandatory courses expiring during contract</p>
            <p className="mt-1 text-sm text-gray-600">Default off: these courses warn. When enabled, they block unless Override training compliance is used. Recommended courses never block.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Block when a mandatory certificate&apos;s expiry is not recorded</p>
            <p className="mt-1 text-sm text-gray-600">Default off: missing expiry dates warn. When enabled, they block unless Override training compliance is used.</p>
          </div>
        </div>
      </div>
      {isLoading ? <div className="h-5 w-40 animate-pulse rounded bg-gray-100" aria-label="Loading training policy" /> :
        isError ? <div className="flex items-center gap-2 text-sm text-red-700" role="alert">Unable to load the training policy. <button className="underline" onClick={() => refetch()}>Retry</button></div> :
          <div className="flex flex-col items-start gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox data-testid="training-block-expiring" checked={blockExpiringDuringContract} disabled={saving} onCheckedChange={checked => setBlockExpiringDuringContract(checked === true)} />
              Block courses expiring during contract
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox data-testid="training-block-missing-expiry" checked={blockMissingExpiry} disabled={saving} onCheckedChange={checked => setBlockMissingExpiry(checked === true)} />
              Block missing expiry
            </label>
            <Button onClick={save} disabled={!data || saving || (blockExpiringDuringContract === data?.blockExpiringDuringContract && blockMissingExpiry === data?.blockMissingExpiry)}>{saving ? "Saving…" : "Save policy"}</Button>
          </div>}
      {error && <p className="w-full text-sm text-red-700" role="alert">{error}</p>}
    </div>
  </section>;
}
