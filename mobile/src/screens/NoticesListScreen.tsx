import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { noticesApi, Notice } from "../api/noticesApi";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../components/CrewUI";

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
           <Text style={styles.emptyKicker}>NOTICEBOARD</Text>
           <Text style={styles.emptyTitle}>No notices published</Text>
           <Text style={styles.emptyText}>Crew communications will appear here when they are ready.</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.noticeUuid}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Read notice ${item.title}`}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
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
          <Text style={styles.fabText}>New notice</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.mist },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 },
  emptyKicker: { color: palette.teal, fontSize: 10, letterSpacing: 1.2, fontWeight: "900" },
  emptyTitle: { color: palette.navy, fontWeight: "800", fontSize: 18, marginTop: 10 },
  emptyText: { color: palette.muted, textAlign: "center", lineHeight: 20, marginTop: 7 },
  item: { marginHorizontal: 16, marginTop: 10, padding: 17, borderRadius: 13, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, flexDirection: "row", alignItems: "center" },
  pressed: { opacity: .72, transform: [{ scale: .99 }] },
  title: { fontSize: 15, fontWeight: "800", color: palette.ink },
  draft: { fontSize: 10, color: palette.amber, fontWeight: "900", letterSpacing: 1, marginTop: 5 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
     backgroundColor: palette.teal,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
   fabText: { color: palette.white, fontWeight: "800" },
});
