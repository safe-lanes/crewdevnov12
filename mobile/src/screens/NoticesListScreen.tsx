import React, { useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { noticesApi } from "../api/noticesApi";
import { useAuth } from "../auth/AuthContext";
import { palette, StateView } from "../components/CrewUI";
import { usePaginatedList } from "../hooks/usePaginatedList";

export default function NoticesListScreen() {
  const navigation = useNavigation<any>();
  const { isAdmin } = useAuth();

  const fetchPage = useCallback(
    (limit: number, offset: number) =>
      isAdmin ? noticesApi.listAllForAdmin({ limit, offset }) : noticesApi.list({ limit, offset }),
    [isAdmin],
  );
  const { items: notices, loading, loadingMore, error, retry: load, loadMore } = usePaginatedList(fetchPage, [isAdmin]);

  return (
    <View style={styles.container}>
      <StateView
        loading={loading && notices.length === 0}
        error={error}
        retry={load}
        empty={!error && notices.length === 0 ? "No notices published" : undefined}
      >
        <FlatList
          data={notices}
          keyExtractor={(item) => item.noticeUuid}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.teal} style={styles.footer} /> : null}
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
      </StateView>

      {isAdmin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New notice"
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
  emptyTitle: { color: palette.navy, fontWeight: "800", fontSize: 18 },
  item: { marginHorizontal: 16, marginTop: 10, padding: 17, borderRadius: 13, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, flexDirection: "row", alignItems: "center" },
  pressed: { opacity: .72, transform: [{ scale: .99 }] },
  title: { fontSize: 15, fontWeight: "800", color: palette.ink },
  draft: { fontSize: 10, color: palette.amber, fontWeight: "900", letterSpacing: 1, marginTop: 5 },
  footer: { marginVertical: 20 },
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
