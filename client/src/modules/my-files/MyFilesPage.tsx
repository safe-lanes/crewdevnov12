import { useEffect, useRef, useState } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { getAuthToken } from "@/lib/authToken";

/**
 * My Files: the shared file module, loaded as one script from /mf/my-files/ on the SAILERP origin and mounted here,
 * the same way the assistant widget is loaded (no new packages). Its contract:
 * my-files-app/src/microfrontend/index.tsx. The bundle reads nothing from browser storage: it gets the SAILERP token,
 * the module code and the vessel from us, and the My Files server enforces permissions. Its API is /m/api/v1, which
 * tenantFetch leaves alone (that only touches URLs starting with /api), so a 401 there does not sign the user out.
 */
const BUNDLE_URL = "/mf/my-files/my-files.js";
const MODULE_CODE = "Crewing"; // exact sails auditmodules.shortname

interface MyFilesApi {
  mount(el: HTMLElement, options: Record<string, unknown>): void;
  unmount(el: HTMLElement): void;
}

let loading: Promise<MyFilesApi> | null = null;
function loadBundle(): Promise<MyFilesApi> {
  const existing = (window as unknown as { MyFilesMf?: MyFilesApi }).MyFilesMf;
  if (existing) return Promise.resolve(existing);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const fail = (message: string) => {
        loading = null;
        script.remove();
        reject(new Error(message));
      };
      const script = document.createElement("script");
      script.src = BUNDLE_URL;
      script.async = true;
      script.onload = () => {
        const api = (window as unknown as { MyFilesMf?: MyFilesApi }).MyFilesMf;
        if (api) resolve(api);
        else fail(`${BUNDLE_URL} did not define window.MyFilesMf`);
      };
      script.onerror = () => fail(`Could not load ${BUNDLE_URL}`);
      document.head.appendChild(script);
    });
  }
  return loading;
}

export default function MyFilesPage() {
  const host = useRef<HTMLDivElement>(null);
  const { myVessels, isLoading } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  // Crewing has no global vessel selector: the vessel is known only when the user has exactly one (a ship user).
  const vesselId = myVessels.length === 1 ? myVessels[0].vesselId : null;

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    let mounted: { api: MyFilesApi; el: HTMLElement } | null = null;
    loadBundle()
      .then((api) => {
        if (cancelled || !host.current) return;
        api.mount(host.current, {
          token: getAuthToken() ?? "",
          getToken: () => getAuthToken() ?? "",
          moduleCode: MODULE_CODE,
          vesselId,
          apiUrl: `${window.location.origin}/b/api/v1`,
          filesApiUrl: `${window.location.origin}/m/api/v1`,
        });
        mounted = { api, el: host.current };
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
      mounted?.api.unmount(mounted.el);
    };
  }, [vesselId, isLoading]);

  if (error) {
    return (
      <div className="p-6 text-center" data-testid="my-files-error">
        <h2 className="text-lg font-semibold text-gray-700 mb-1">My Files could not be loaded</h2>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }
  return <div ref={host} data-testid="my-files-page" />;
}
