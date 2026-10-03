import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { mobileOutbox } from "../outbox/outbox";
import type { OutboxOperation, OutboxStatus } from "../outbox/types";
import { palette, styles } from "./CrewUI";

const LABELS: Record<OutboxStatus, string> = {
  QUEUED: "Waiting to sync",
  SENDING: "Syncing",
  AWAITING_CONFIRMATION: "Confirming safely",
  WAITING_RETRY: "Will retry when the connection improves",
  NEEDS_RECONCILIATION: "Needs office review",
  COMPLETED: "Synced",
  REJECTED: "Could not sync",
};

export default function OutboxStatusCard() {
  const [items, setItems] = useState<OutboxOperation[]>([]);
  useEffect(() => {
    let mounted = true;
    const load = () => void mobileOutbox.listCurrent().then((next) => { if (mounted) setItems(next); }).catch(() => undefined);
    load(); const unsubscribe = mobileOutbox.subscribe(load);
    return () => { mounted = false; unsubscribe(); };
  }, []);
  const visible = items.filter((item) => item.status !== "COMPLETED").slice(0, 5);
  if (!visible.length) return <View style={styles.card} accessibilityLiveRegion="polite">
    <Text style={styles.cardTitle}>Profile sync</Text>
    <Text style={{ color: palette.teal, marginTop: 6, fontWeight: "700" }}>All changes synced</Text>
  </View>;
  return <View style={styles.card} accessibilityLiveRegion="polite">
    <Text style={styles.cardTitle}>Profile sync</Text>
    {visible.map((item) => <Text key={item.localId} style={{ color: item.status === "NEEDS_RECONCILIATION" || item.status === "REJECTED" ? palette.red : palette.amber, marginTop: 6, fontWeight: "700" }}>
      {LABELS[item.status]}
    </Text>)}
  </View>;
}
