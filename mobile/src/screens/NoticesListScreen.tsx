import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { noticesApi, Notice } from "../api/noticesApi";
import { useAuth } from "../auth/AuthContext";

export default function NoticesListScreen() {
  const navigation = useNavigation<any>();
  const { isAdmin } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = isAdmin ? await noticesApi.listAllForAdmin() : await noticesApi.list();
      setNotices(data);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      {notices.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No notices yet.</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.noticeUuid}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              onPress={() => navigation.navigate("NoticeDetail", { noticeUuid: item.noticeUuid })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                {isAdmin && !item.isPublished ? <Text style={styles.draft}>DRAFT</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      {isAdmin ? (
        <Pressable
          style={styles.fab}
          onPress={() => navigation.navigate("AdminNoticeEdit", {})}
          testID="new-notice-button"
        >
          <Text style={styles.fabText}>+ New Notice</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { color: "#666" },
  item: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee", flexDirection: "row", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "600" },
  draft: { fontSize: 11, color: "#c60", fontWeight: "700", marginTop: 4 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#0a5",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  fabText: { color: "#fff", fontWeight: "700" },
});
