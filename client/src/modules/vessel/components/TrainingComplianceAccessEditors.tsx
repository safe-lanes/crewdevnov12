import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, ShieldCheck } from "lucide-react";

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

const TRAINING_OVERRIDE_HELP =
  "Lets this role approve a deployment that training rules would otherwise block — for example a seafarer missing a mandatory certificate.";

export function TrainingCompliancePermissionRow({
  allowed,
  onChange,
  disabled = false,
}: {
  allowed: boolean;
  onChange: (allowed: boolean) => void;
  disabled?: boolean;
}) {
  const helpId = "training-deployment-override-help";
  return (
    <TooltipProvider delayDuration={250}>
    <div className="col-span-4 flex min-h-[58px] items-center justify-center gap-2 px-3 py-2.5" data-testid="training-compliance-permission-action">
      <Checkbox
        checked={allowed}
        disabled={disabled}
        onCheckedChange={value => onChange(value === true)}
        aria-label="Override deployment block"
        data-testid="training-compliance-permission-checkbox"
        className="h-[18px] w-[18px] shrink-0 border-gray-300 data-[state=checked]:border-[#52baf3] data-[state=checked]:bg-[#52baf3]"
      />
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Help: Override deployment block"
                aria-describedby={helpId}
                onClick={event => event.stopPropagation()}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#16569e] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16569e]"
              >
                <Info aria-hidden="true" className="h-4 w-4" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-sm leading-5">{TRAINING_OVERRIDE_HELP}</TooltipContent>
        </Tooltip>
        <PopoverContent id={helpId} side="top" className="w-72 text-sm leading-5">
          {TRAINING_OVERRIDE_HELP}
        </PopoverContent>
      </Popover>
    </div>
    </TooltipProvider>
  );
}

export function TrainingCompliancePolicyDialog() {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" onClick={() => setOpen(true)} data-testid="button-training-compliance-policy">
      <ShieldCheck aria-hidden="true" className="mr-2 h-4 w-4" />Blocking Seafarer Deployment
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} className="max-h-[92vh] w-[min(800px,96vw)] max-w-none overflow-y-auto border-slate-200 bg-[#fbfcfd] p-0" data-testid="training-compliance-policy-dialog">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogTitle>Blocking Seafarer Deployment Policy</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-5">
          <TrainingCompliancePolicySetting />
        </div>
      </DialogContent>
    </Dialog>
  </>;
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
    } catch { setError("Unable to save the deployment blocking policy. Please retry."); }
    finally { setSaving(false); }
  }
  return <TooltipProvider delayDuration={200}><section className="overflow-hidden rounded-lg border border-gray-200 bg-white" data-testid="training-compliance-policy">
    <div className="border-b border-gray-200 bg-[#16569e] px-4 py-3 text-white"><h2 className="font-semibold">Blocking Seafarer Deployment Policy</h2></div>
    <div className="space-y-4 p-4">
      {isLoading ? <div className="space-y-3" aria-label="Loading deployment blocking policy">
        <div className="h-20 animate-pulse rounded-md bg-gray-100" />
        <div className="h-20 animate-pulse rounded-md bg-gray-100" />
      </div> :
        isError ? <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">Unable to load the deployment blocking policy. <button className="underline" onClick={() => refetch()}>Retry</button></div> :
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
                  description="A seafarer whose mandatory certificate expires before the planned sign-off cannot be deployed unless someone with Override deployment block permission approves it. This uses the planned contract end date, not an actual sign-off event. Recommended courses do not block."
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
                  description="A seafarer whose mandatory certificate needs an expiry date but has none recorded cannot be deployed unless someone with Override deployment block permission approves it."
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
