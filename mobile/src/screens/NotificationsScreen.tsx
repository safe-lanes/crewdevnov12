import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { notificationsApi, AppNotification } from "../api/notificationsApi";
import { palette } from "../components/CrewUI";

function typeLabel(type: string): string {
  if (type === "notice") return "Notice";
  if (type === "document_expiry") return "Document";
  if (type === "visa_expiry") return "Visa";
  return type;
}

function BellMark() {
  return (
    <View style={styles.bell} accessible={false}>
      <View style={styles.bellDome} />
      <View style={styles.bellBase} />
      <View style={styles.bellClapper} />
    </View>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.list();
      setNotifications(data);
    } catch {
      // best-effort — leave the previous list visible on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onPressItem = async (item: AppNotification) => {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item.notificationUuid);
        setNotifications((prev) =>
          prev.map((n) => (n.notificationUuid === item.notificationUuid ? { ...n, isRead: true } : n)),
        );
      } catch {
        // ignore — non-critical
      }
    }
  };

  if (notifications.length === 0 && !loading) {
    return (
      <View style={styles.empty}>
         <View style={styles.emptyMark}><BellMark /></View>
         <Text style={styles.emptyTitle}>All clear for now</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={notifications}
      keyExtractor={(item) => item.notificationUuid}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} style={({ pressed }) => [styles.item, !item.isRead && styles.unread, pressed && styles.pressed]} onPress={() => onPressItem(item)}>
          <Text style={styles.type}>{typeLabel(item.notificationType)}</Text>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, backgroundColor: palette.mist, flexGrow: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28, backgroundColor: palette.mist },
  emptyMark: { width: 54, height: 54, borderRadius: 17, backgroundColor: "#D9ECEE", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  bell: { width: 24, height: 25, alignItems: "center", justifyContent: "flex-end" },
  bellDome: { position: "absolute", top: 2, width: 19, height: 18, borderWidth: 2, borderColor: palette.teal, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomWidth: 0 },
  bellBase: { width: 23, height: 2, borderRadius: 1, backgroundColor: palette.teal, marginBottom: 3 },
  bellClapper: { width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: palette.teal },
  emptyTitle: { color: palette.navy, fontWeight: "800", fontSize: 18 },
  item: { padding: 17, marginBottom: 10, borderRadius: 13, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line },
  unread: { borderLeftWidth: 4, borderLeftColor: palette.teal, backgroundColor: "#F4FBFB" },
  pressed: { opacity: .72, transform: [{ scale: .99 }] },
  type: { fontSize: 10, color: palette.teal, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 15, fontWeight: "800", color: palette.ink, marginTop: 5 },
  body: { fontSize: 13, color: palette.muted, marginTop: 5, lineHeight: 19 },
});
