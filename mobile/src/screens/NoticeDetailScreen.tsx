import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { noticesApi, Notice } from "../api/noticesApi";
import { useAuth } from "../auth/AuthContext";

export default function NoticeDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { isAdmin } = useAuth();
  const noticeUuid: string = route.params.noticeUuid;

  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      noticesApi
        .get(noticeUuid)
        .then((n) => {
          if (!cancelled) setNotice(n);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [noticeUuid]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!notice) {
    return (
      <View style={styles.center}>
        <Text>Notice not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{notice.title}</Text>
      {notice.publishedAt ? <Text style={styles.date}>{new Date(notice.publishedAt).toLocaleString()}</Text> : null}
      <Text style={styles.body}>{notice.body}</Text>

      {isAdmin ? (
        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate("AdminNoticeEdit", { noticeUuid })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: "700" },
  date: { fontSize: 12, color: "#888", marginTop: 4 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 16, color: "#222" },
  editButton: {
    marginTop: 24,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#0a5",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editButtonText: { color: "#0a5", fontWeight: "600" },
});
