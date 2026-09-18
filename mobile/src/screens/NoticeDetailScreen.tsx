import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { noticesApi, Notice } from "../api/noticesApi";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../components/CrewUI";

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
        <ActivityIndicator color={palette.teal} />
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
          accessibilityRole="button"
          accessibilityLabel="Edit notice"
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.mist },
  container: { padding: 20, backgroundColor: palette.mist, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "800", color: palette.navy },
  date: { fontSize: 12, color: palette.muted, marginTop: 6 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 18, color: palette.ink },
  editButton: {
    marginTop: 24,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  editButtonText: { color: palette.teal, fontWeight: "800" },
});
