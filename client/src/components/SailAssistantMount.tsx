import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { usePermissions } from "@/contexts/PermissionsContext";
import { getTenantId } from "@/lib/tenantStorage";
import { useSailAssistant } from "@/hooks/useSailAssistant";
import { ASSISTANT_MODULE, assistantUrl, loadWidgetBundle, uiAllowedRoles } from "@/lib/sailAssistant";

/**
 * Mounts the shared SAIL chat widget for Crewing (knowledge answers).
 * The visibility check here is cosmetic; GET /api/v2/assistant/token enforces Office + allowed role on the server.
 * Vessel context is optional: only the vessel rest-hours page carries one.
 */
async function fetchAssistantToken({ signal }: { forceRefresh: boolean; signal: AbortSignal }): Promise<string> {
  // tenantFetch adds the SAILERP Bearer token + x-tenant-id; a 401 there signs the user out.
  const r = await fetch("/api/v2/assistant/token", { signal, cache: "no-store" });
  if (!r.ok) throw new Error(`assistant token HTTP ${r.status}`);
  const j = await r.json();
  if (!j?.token) throw new Error("assistant token missing");
  return j.token as string;
}

const VESSEL_ROUTE = /^\/rest-hours\/vessel\/([^/]+)/;

export function SailAssistantMount() {
  const base = assistantUrl();
  const { userId, userType, roleName, myVessels, isLoading } = usePermissions();
  const [location] = useLocation();
  const [bundleReady, setBundleReady] = useState(false);

  const visible =
    !!base &&
    !isLoading &&
    !!userId &&
    (userType || "").trim().toLocaleLowerCase() === "office" &&
    uiAllowedRoles().includes((roleName || "").trim().toLocaleLowerCase());

  useEffect(() => {
    if (!visible || !base) return;
    let alive = true;
    loadWidgetBundle(base).then((ok) => alive && setBundleReady(ok));
    return () => {
      alive = false;
    };
  }, [visible, base]);

  const vesselId = useMemo(() => {
    const m = VESSEL_ROUTE.exec(location);
    return m ? decodeURIComponent(m[1]) : null;
  }, [location]);
  const vesselName = vesselId ? myVessels.find((v) => v.vesselId === vesselId)?.vessel ?? null : null;

  useSailAssistant({
    enabled: visible && bundleReady,
    assistantUrl: base || "",
    module: ASSISTANT_MODULE,
    title: "Crewing Assistant",
    // Stage 2 (live data): the widget's default intro says answers come only from the manuals — no longer true.
    intro:
      "Ask how to do something in Crewing — answered from the user manuals, with their sources. " +
      "Or ask about current crew data, such as who is on board or which licences and training certificates are expiring — " +
      "answered from Crewing data, with the date it applies to.",
    getToken: fetchAssistantToken,
    context: { userKey: userId, tenantKey: getTenantId(), vesselId, vesselName, currentPage: location },
  });

  return null;
}
