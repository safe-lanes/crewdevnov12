import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function TrainingPolicyLabel({ id, controlId, title, description }: {
  id: string;
  controlId: string;
  title: string;
  description: string;
}) {
  return <>
    <Tooltip>
      <TooltipTrigger asChild>
        <h3 id={`${id}-title`} tabIndex={0} className="text-sm font-semibold text-gray-800">
          <label htmlFor={controlId} className="cursor-pointer">{title}</label>
        </h3>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-sm text-sm leading-5">
        {description}
      </TooltipContent>
    </Tooltip>
    <p id={`${id}-description`} className="sr-only">{description}</p>
  </>;
}

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
  return <TooltipProvider delayDuration={200}><section className="overflow-hidden rounded-lg border border-gray-200 bg-white" data-testid="training-compliance-policy">
    <div className="border-b border-gray-200 bg-[#16569e] px-4 py-3 text-white"><h2 className="font-semibold">Training compliance policy</h2></div>
    <div className="space-y-4 p-4">
      {isLoading ? <div className="space-y-3" aria-label="Loading training policy">
        <div className="h-20 animate-pulse rounded-md bg-gray-100" />
        <div className="h-20 animate-pulse rounded-md bg-gray-100" />
      </div> :
        isError ? <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">Unable to load the training policy. <button className="underline" onClick={() => refetch()}>Retry</button></div> :
          <>
            <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-4" data-testid="training-expiring-policy-block">
              <Checkbox
                id="training-block-expiring"
                checked={blockExpiringDuringContract}
                disabled={saving}
                onCheckedChange={checked => setBlockExpiringDuringContract(checked === true)}
                aria-labelledby="training-expiring-title"
                aria-describedby="training-expiring-description"
                data-testid="training-block-expiring"
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <TrainingPolicyLabel
                  id="training-expiring"
                  controlId="training-block-expiring"
                  title="Block seafarer deployment when mandatory courses expiring during contract"
                  description="A seafarer whose mandatory certificate expires before the planned sign-off cannot be deployed unless someone with Override training compliance permission approves it. This uses the planned contract end date, not an actual sign-off event. Recommended courses do not block."
                />
                <p className="mt-2 text-sm font-medium text-gray-800" data-testid="training-expiring-current-effect">
                  Current saved effect: {data?.blockExpiringDuringContract ? "Blocking" : "Warning only"}
                </p>
                {data && blockExpiringDuringContract !== data.blockExpiringDuringContract && <p className="mt-1 text-xs font-medium text-amber-800" data-testid="training-expiring-unsaved">Unsaved selection — the current effect above has not changed.</p>}
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-4" data-testid="training-missing-expiry-policy-block">
              <Checkbox
                id="training-block-missing-expiry"
                checked={blockMissingExpiry}
                disabled={saving}
                onCheckedChange={checked => setBlockMissingExpiry(checked === true)}
                aria-labelledby="training-missing-expiry-title"
                aria-describedby="training-missing-expiry-description"
                data-testid="training-block-missing-expiry"
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <TrainingPolicyLabel
                  id="training-missing-expiry"
                  controlId="training-block-missing-expiry"
                  title="Block seafarer deployment when a mandatory certificate's expiry is not recorded"
                  description="A seafarer whose mandatory certificate needs an expiry date but has none recorded cannot be deployed unless someone with Override training compliance permission approves it."
                />
                <p className="mt-2 text-sm font-medium text-gray-800" data-testid="training-missing-expiry-current-effect">
                  Current saved effect: {data?.blockMissingExpiry ? "Blocking" : "Warning only"}
                </p>
                {data && blockMissingExpiry !== data.blockMissingExpiry && <p className="mt-1 text-xs font-medium text-amber-800" data-testid="training-missing-expiry-unsaved">Unsaved selection — the current effect above has not changed.</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={!data || saving || (blockExpiringDuringContract === data?.blockExpiringDuringContract && blockMissingExpiry === data?.blockMissingExpiry)} data-testid="save-training-compliance-policy">{saving ? "Saving…" : "Save policy"}</Button>
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            </div>
          </>}
    </div>
  </section></TooltipProvider>;
}
