import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { notificationsApi, AppNotification } from "../api/notificationsApi";

function typeLabel(type: string): string {
  if (type === "notice") return "Notice";
  if (type === "document_expiry") return "Document";
  if (type === "visa_expiry") return "Visa";
  return type;
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
        <Text style={styles.emptyText}>No notifications yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.notificationUuid}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      renderItem={({ item }) => (
        <Pressable style={[styles.item, !item.isRead && styles.unread]} onPress={() => onPressItem(item)}>
          <Text style={styles.type}>{typeLabel(item.notificationType)}</Text>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { color: "#666" },
  item: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  unread: { backgroundColor: "#f0faf5" },
  type: { fontSize: 11, color: "#0a5", fontWeight: "700", textTransform: "uppercase" },
  title: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  body: { fontSize: 13, color: "#555", marginTop: 4 },
});
