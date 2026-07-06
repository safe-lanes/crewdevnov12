import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountsApiV2, parseApiError, ACCOUNTS_BASE } from "../api/accountsApiV2";
import {
  PREPARATION_MODES,
  PRORATION_BASES,
  FX_RATE_POLICIES,
  SENIORITY_BASES,
  EMPLOYMENT_MODELS,
  CURRENCIES,
  type Option,
} from "../accountsConstants";

const CONFIG_KEY = [`${ACCOUNTS_BASE}/config`];

interface ConfigForm {
  preparationMode: string;
  prorationBasis: string;
  functionalCurrency: string;
  fxRatePolicy: string;
  employmentModelsEnabled: string[];
  seniorityBasis: string;
  allowManualSeniorityAnchor: boolean;
  autoLockOnApproval: boolean;
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-[#16569e]">{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function SelectField({
  label,
  helper,
  value,
  options,
  onChange,
  testId,
  disabled,
}: {
  label: string;
  helper: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} helper={helper}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export default function TenantConfigPage() {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const editable = canEdit("Account Tenant Configuration");
  const { data, isLoading } = useQuery<any>({ queryKey: CONFIG_KEY });

  const [form, setForm] = useState<ConfigForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      preparationMode: data.preparationMode ?? "office_prepares",
      prorationBasis: data.prorationBasis ?? "thirty_day_month",
      functionalCurrency: data.functionalCurrency ?? "USD",
      fxRatePolicy: data.fxRatePolicy ?? "month_end",
      employmentModelsEnabled: data.employmentModelsEnabled ?? [],
      seniorityBasis: data.seniorityBasis ?? "rank_service_all_employers",
      allowManualSeniorityAnchor: data.allowManualSeniorityAnchor ?? true,
      autoLockOnApproval: data.autoLockOnApproval ?? true,
    });
  }, [data]);

  const set = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const toggleModel = (value: string, checked: boolean) =>
    setForm((f) => {
      if (!f) return f;
      const next = checked
        ? Array.from(new Set([...f.employmentModelsEnabled, value]))
        : f.employmentModelsEnabled.filter((v) => v !== value);
      return { ...f, employmentModelsEnabled: next };
    });

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await accountsApiV2.config.update({ ...form });
      await queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
      toast({
        title: "Configuration saved",
        description: "Tenant configuration has been updated.",
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="p-6 text-sm text-muted-foreground" data-testid="tenant-config-loading">
        Loading configuration…
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="page-tenant-config">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-[#16569e]">
          Tenant Configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          These settings control how payroll is prepared and calculated for this
          company. They apply to every vessel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Preparation & currency</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SelectField
              label="Preparation mode"
              helper="Choose whether the vessel or the office builds each month's portage bill first."
              value={form.preparationMode}
              options={PREPARATION_MODES}
              onChange={(v) => set("preparationMode", v)}
              testId="select-preparation-mode"
              disabled={!editable}
            />
            <SelectField
              label="Proration basis"
              helper="How partial months are split: a fixed 30-day month or the actual calendar days."
              value={form.prorationBasis}
              options={PRORATION_BASES}
              onChange={(v) => set("prorationBasis", v)}
              testId="select-proration-basis"
              disabled={!editable}
            />
            <SelectField
              label="Functional currency"
              helper="The reporting currency all amounts are converted to for company totals."
              value={form.functionalCurrency}
              options={CURRENCIES}
              onChange={(v) => set("functionalCurrency", v)}
              testId="select-functional-currency"
              disabled={!editable}
            />
            <SelectField
              label="FX rate policy"
              helper="Which exchange rate is used when converting foreign-currency amounts."
              value={form.fxRatePolicy}
              options={FX_RATE_POLICIES}
              onChange={(v) => set("fxRatePolicy", v)}
              testId="select-fx-rate-policy"
              disabled={!editable}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Employment & seniority</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field
              label="Employment models enabled"
              helper="The contract types this company uses; only enabled models can be assigned to crew."
            >
              <div className="flex flex-col gap-2 pt-1">
                {EMPLOYMENT_MODELS.map((m) => (
                  <label
                    key={m.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={form.employmentModelsEnabled.includes(m.value)}
                      onCheckedChange={(c) => toggleModel(m.value, c === true)}
                      disabled={!editable}
                      data-testid={`checkbox-model-${m.value}`}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </Field>
            <SelectField
              label="Seniority basis"
              helper="How a seafarer's years of service are counted when picking a wage-scale step."
              value={form.seniorityBasis}
              options={SENIORITY_BASES}
              onChange={(v) => set("seniorityBasis", v)}
              testId="select-seniority-basis"
              disabled={!editable}
            />
            <Field
              label="Allow manual seniority anchor"
              helper="Let administrators set a seafarer's seniority start date by hand instead of deriving it."
            >
              <Switch
                checked={form.allowManualSeniorityAnchor}
                onCheckedChange={(c) => set("allowManualSeniorityAnchor", c)}
                disabled={!editable}
                data-testid="switch-manual-seniority"
              />
            </Field>
            <Field
              label="Auto-lock on approval"
              helper="Automatically lock a portage bill for editing once it has been approved."
            >
              <Switch
                checked={form.autoLockOnApproval}
                onCheckedChange={(c) => set("autoLockOnApproval", c)}
                disabled={!editable}
                data-testid="switch-auto-lock"
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      {editable && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#16569e] hover:bg-[#12467f]"
            data-testid="button-save-config"
          >
            {saving ? "Saving…" : "Save configuration"}
          </Button>
        </div>
      )}
    </div>
  );
}
