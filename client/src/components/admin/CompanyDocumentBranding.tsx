import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BrandingHistoryEntry {
  version: number;
  companyName: string;
  createdAt: string;
  actorName: string;
}
interface BrandingSettings {
  companyName: string;
  logoVersionUuid: string | null;
  version: number;
  history: BrandingHistoryEntry[];
  realGenerationEnabled: false;
}
const brandingUrl = "/api/v2/company-form-submissions/settings/branding";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CompanyDocumentBranding() {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const brandingQuery = useQuery({
    queryKey: ["company-document-branding"],
    queryFn: async () => {
      const response = await apiRequest("GET", brandingUrl);
      return await response.json() as BrandingSettings;
    },
    enabled: open,
    retry: false,
  });

  useEffect(() => {
    if (!open || !brandingQuery.data) return;
    setCompanyName(brandingQuery.data.companyName ?? "");
    setDataUrl(null);
    setLogoName("");
    setFormError(null);
  }, [open, brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { companyName: string; dataUrl: string | null }) => {
      const response = await apiRequest("POST", brandingUrl, payload);
      return await response.json() as BrandingSettings;
    },
    onSuccess: async (settings) => {
      queryClient.setQueryData(["company-document-branding"], settings);
      await queryClient.invalidateQueries({ queryKey: ["company-document-branding"] });
      setDataUrl(null);
      setLogoName("");
    },
    onError: () => setFormError("Branding could not be saved. Check the details and try again."),
  });

  const chooseLogo = (file?: File) => {
    setFormError(null);
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setFormError("Choose a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setFormError("The image must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDataUrl(reader.result);
        setLogoName(file.name);
      } else {
        setFormError("The selected image could not be read.");
      }
    };
    reader.onerror = () => setFormError("The selected image could not be read.");
    reader.readAsDataURL(file);
  };

  const save = (logoDataUrl: string | null) => {
    setFormError(null);
    saveMutation.mutate({ companyName: companyName.trim(), dataUrl: logoDataUrl });
  };
  const settings = brandingQuery.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Building2 aria-hidden="true" /> Company PDF branding
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Company PDF branding</DialogTitle>
          <DialogDescription>
            Manage the company name and logo used for future Company PDF versions.
          </DialogDescription>
        </DialogHeader>
        {brandingQuery.isPending ? (
          <div className="space-y-3 py-4" role="status" aria-label="Loading branding settings">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded bg-muted" />
            <div className="h-28 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : brandingQuery.error ? (
          <div className="space-y-3 py-3" role="alert">
            <p className="text-sm text-destructive">Branding settings could not be loaded.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void brandingQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : settings ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="company-branding-name" className="text-sm font-medium">Company name</label>
              <Input
                id="company-branding-name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Leave blank to use fallback text"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">When blank, the PDF uses its standard company name text.</p>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Logo</span>
              <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed bg-muted/30 p-4">
                {dataUrl ? (
                  <img src={dataUrl} alt="Selected company logo preview" className="max-h-24 max-w-full object-contain" />
                ) : settings.logoVersionUuid ? (
                  <p className="text-sm text-muted-foreground">A logo is saved in the current branding version.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No logo selected. The company name will appear as text.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex">
                  <span className="sr-only">Choose a PNG or JPEG logo, maximum 2 MB</span>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="h-9 max-w-full cursor-pointer text-xs file:mr-2 file:cursor-pointer"
                    onChange={(event) => chooseLogo(event.currentTarget.files?.[0])}
                    aria-label="Choose PNG or JPEG logo (2 MB maximum)"
                  />
                </label>
                <span className="text-xs text-muted-foreground">
                  {logoName || "PNG or JPEG · up to 2 MB"}
                </span>
                {dataUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setDataUrl(null); setLogoName(""); }}>
                    <Trash2 aria-hidden="true" /> Clear selection
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">PDF generation is disabled</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Real-form PDF generation remains off pending layout approval.
              </p>
            </div>
            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
            <section className="space-y-2 border-t pt-4" aria-labelledby="branding-history-title">
              <h3 id="branding-history-title" className="text-sm font-semibold">Version history</h3>
              {settings.history?.length ? (
                <ol className="max-h-40 space-y-2 overflow-y-auto text-sm">
                  {settings.history.map((entry) => (
                    <li key={`${entry.version}-${entry.createdAt}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-md bg-muted/40 px-3 py-2">
                      <span className="font-medium">Version {entry.version} · {entry.companyName || "Fallback company name"}</span>
                      <span className="text-muted-foreground">
                        {formatCreatedAt(entry.createdAt)} · {entry.actorName || "Administrator"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No branding versions have been saved.</p>
              )}
            </section>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
          {settings && !brandingQuery.error && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() => save(null)}
              >
                <Trash2 aria-hidden="true" /> Save without logo
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending || Boolean(settings.logoVersionUuid && !dataUrl)}
                title={settings.logoVersionUuid && !dataUrl
                  ? "Choose a replacement logo or use Save without logo to remove the current one."
                  : undefined}
                aria-describedby={settings.logoVersionUuid && !dataUrl ? "branding-logo-preservation-hint" : undefined}
                className="disabled:cursor-not-allowed"
                onClick={() => save(dataUrl)}
              >
                {saveMutation.isPending
                  ? <><Loader2 className="animate-spin" aria-hidden="true" /> Saving…</>
                  : <><ImagePlus aria-hidden="true" /> Save branding</>}
              </Button>
              {settings.logoVersionUuid && !dataUrl && (
                <span id="branding-logo-preservation-hint" className="sr-only">
                  Choose a replacement logo or use Save without logo to remove the current one.
                </span>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
