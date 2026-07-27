import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DAY_INCLUSION_RULES,
  FX_RATE_POLICIES,
  SENIORITY_BASES,
  EMPLOYMENT_MODELS,
  CURRENCIES,
  type Option,
} from "../accountsConstants";

const CONFIG_KEY = [`${ACCOUNTS_BASE}/config`];

interface ExtraTabSlot {
  enabled: boolean;
  label: string;
  payElementUuid: string;
}

interface ConfigForm {
  preparationMode: string;
  prorationBasis: string;
  dayInclusionRule: string;
  maxAllotmentPercent: string;
  functionalCurrency: string;
  fxRatePolicy: string;
  employmentModelsEnabled: string[];
  seniorityBasis: string;
  allowManualSeniorityAnchor: boolean;
  autoLockOnApproval: boolean;
  glWagesPayableCode: string;
  extraTab1: ExtraTabSlot;
  extraTab2: ExtraTabSlot;
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
      dayInclusionRule: data.dayInclusionRule ?? "both_inclusive",
      maxAllotmentPercent:
        data.maxAllotmentPercent != null ? String(data.maxAllotmentPercent) : "",
      functionalCurrency: data.functionalCurrency ?? "USD",
      fxRatePolicy: data.fxRatePolicy ?? "month_end",
      employmentModelsEnabled: data.employmentModelsEnabled ?? [],
      seniorityBasis: data.seniorityBasis ?? "rank_service_all_employers",
      allowManualSeniorityAnchor: data.allowManualSeniorityAnchor ?? true,
      autoLockOnApproval: data.autoLockOnApproval ?? true,
      glWagesPayableCode: data.glWagesPayableCode ?? "",
      extraTab1: {
        enabled: data.extraTab1Enabled ?? false,
        label: data.extraTab1Label ?? "",
        payElementUuid: data.extraTab1PayElementUuid ?? "",
      },
      extraTab2: {
        enabled: data.extraTab2Enabled ?? false,
        label: data.extraTab2Label ?? "",
        payElementUuid: data.extraTab2PayElementUuid ?? "",
      },
    });
  }, [data]);

  // Elements a configurable vessel-entry tab may bind to (0179 rule).
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });
  const bindableElements = payElements.filter(
    (e) =>
      e.status === "active" &&
      (e.calcMethod === "manual_entry" || e.calcMethod === "rate_times_qty"),
  );

  const setSlot = (
    slot: "extraTab1" | "extraTab2",
    patch: Partial<ExtraTabSlot>,
  ) =>
    setForm((f) => (f ? { ...f, [slot]: { ...f[slot], ...patch } } : f));

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
      const { extraTab1, extraTab2, ...rest } = form;
      await accountsApiV2.config.update({
        ...rest,
        glWagesPayableCode: form.glWagesPayableCode.trim() || null,
        maxAllotmentPercent: form.maxAllotmentPercent.trim() || null,
        extraTab1Enabled: extraTab1.enabled,
        extraTab1Label: extraTab1.label.trim() || null,
        extraTab1PayElementUuid: extraTab1.payElementUuid || null,
        extraTab2Enabled: extraTab2.enabled,
        extraTab2Label: extraTab2.label.trim() || null,
        extraTab2PayElementUuid: extraTab2.payElementUuid || null,
      });
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
              label="Day inclusion rule"
              helper="Whether the sign-off day itself counts as a paid service day."
              value={form.dayInclusionRule}
              options={DAY_INCLUSION_RULES}
              onChange={(v) => set("dayInclusionRule", v)}
              testId="select-day-inclusion-rule"
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
            <Field
              label="GL wages payable account"
              helper="GL account code the GL export credits with the month's net wages payable. Leave blank to flag it as UNMAPPED."
            >
              <Input
                value={form.glWagesPayableCode}
                onChange={(e) => set("glWagesPayableCode", e.target.value)}
                placeholder="e.g. 2100-WAGES"
                className="h-9"
                disabled={!editable}
                data-testid="input-gl-wages-payable-code"
              />
            </Field>
            <Field
              label="Max allotment percent"
              helper="Soft cap: warns when a crew member's active allotments exceed this percentage of their scale gross. Leave blank to disable."
            >
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.maxAllotmentPercent}
                onChange={(e) => set("maxAllotmentPercent", e.target.value)}
                placeholder="e.g. 80"
                className="h-9"
                disabled={!editable}
                data-testid="input-max-allotment-percent"
              />
            </Field>
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

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vessel entry tabs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Adds an extra entry tab on the vessel's portage screen, bound to
              this pay element. Use for client-specific deductions such as
              radio/telephone or laundry.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {([1, 2] as const).map((n) => {
                const key = `extraTab${n}` as "extraTab1" | "extraTab2";
                const slot = form[key];
                return (
                  <div
                    key={n}
                    className="border rounded-md p-3 flex flex-col gap-3"
                    data-testid={`panel-extra-tab-${n}`}
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-[#16569e]">
                        Extra tab {n}
                      </Label>
                      <Switch
                        checked={slot.enabled}
                        onCheckedChange={(c) => setSlot(key, { enabled: c })}
                        disabled={!editable}
                        data-testid={`switch-extra-tab-${n}-enabled`}
                      />
                    </div>
                    <Field
                      label="Tab label"
                      helper="Shown as the tab name on the vessel's portage screen."
                    >
                      <Input
                        value={slot.label}
                        onChange={(e) => setSlot(key, { label: e.target.value })}
                        placeholder="e.g. Radio / Telephone"
                        className="h-9"
                        disabled={!editable}
                        data-testid={`input-extra-tab-${n}-label`}
                      />
                    </Field>
                    <Field
                      label="Pay element"
                      helper="Entries on this tab post to this element (manual entry or rate × qty elements only)."
                    >
                      <Select
                        value={slot.payElementUuid || undefined}
                        onValueChange={(v) =>
                          setSlot(key, { payElementUuid: v })
                        }
                        disabled={!editable}
                      >
                        <SelectTrigger
                          className="h-9"
                          data-testid={`select-extra-tab-${n}-element`}
                        >
                          <SelectValue placeholder="Select pay element" />
                        </SelectTrigger>
                        <SelectContent>
                          {bindableElements.map((e) => (
                            <SelectItem
                              key={e.payElementUuid}
                              value={e.payElementUuid}
                            >
                              {e.code} — {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                );
              })}
            </div>
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
