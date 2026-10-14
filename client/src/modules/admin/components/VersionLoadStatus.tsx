import type { VersionLoadResult } from "../formsListVersions";

export function VersionLoadStatus({ state, retry }: {
  state: VersionLoadResult["state"]; retry: () => void;
}) {
  if (state === "loaded") return null;
  return <div className="flex items-center gap-2" role={state === "error" ? "alert" : "status"}>
    <span>{state === "error" ? "Could not load" : "Loading versions…"}</span>
    {state === "error" && <button type="button" className="text-blue-700 underline"
      onClick={retry}>Retry</button>}
  </div>;
}
