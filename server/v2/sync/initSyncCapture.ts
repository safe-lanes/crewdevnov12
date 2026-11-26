// Start-up wiring for change capture (SYN-01). Called once after migrations.
// Resolves the instance id, loads the table classification and sets the sink.
// If the instance id is not configured the sink stays unset and a loud error is
// logged: logging with a placeholder id would produce rows that never sync.

import { setChangeSink } from "./changeCapture";
import { fieldLogSink } from "./fieldLogSink";
import { getEffectiveInstanceId } from "./syncRole";
import { refreshSyncConfig } from "./syncConfig";

export async function initSyncCapture(
  getDb: () => { execute: (q: any) => Promise<any> },
): Promise<boolean> {
  try {
    const db = getDb(); // throws in multi-tenant mode: no tenant at start-up
    const instanceId = await getEffectiveInstanceId(db);
    const config = await refreshSyncConfig(db);
    setChangeSink(fieldLogSink);
    const logged = [...config.values()].filter((c) => c.category === "BOTH_EDITABLE").length;
    console.log(`[Sync] Change capture on: instance '${instanceId}', ${logged} table(s) logged.`);
    return true;
  } catch (err: any) {
    setChangeSink(null);
    console.error(`[Sync] ⚠️ Change capture is OFF: ${err?.message || err}`);
    return false;
  }
}
