import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { contentApi, ContentPage, ContentPageKey } from "../api/contentApi";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../components/CrewUI";
import { useAsyncOnFocus } from "../hooks/useAsyncOnFocus";

const TITLES: Record<ContentPageKey, string> = {
  about_us: "About Us",
  contact_us: "Contact Us",
  forum: "Forum",
};

export default function ContentPageScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { isAdmin } = useAuth();
  const pageKey: ContentPageKey = route.params.pageKey;

  const [page, setPage] = useState<ContentPage | null>(null);

  const { loading, error } = useAsyncOnFocus(async () => {
    try {
      const data = await contentApi.getPage(pageKey);
      setPage(data);
    } catch (err: any) {
      throw new Error(err?.message === "Content page not found" ? "This page hasn't been set up yet." : err?.message);
    }
  }, [pageKey]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{TITLES[pageKey]}</Text>
      {isAdmin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${TITLES[pageKey]}`}
          style={styles.editButton}
          onPress={() => navigation.navigate("AdminContentEdit", { pageKey })}
          testID="edit-content-button"
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      ) : null}

      {loading ? <ActivityIndicator color={palette.teal} style={{ marginTop: 24 }} /> : null}
      {!loading && error ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!loading && page ? <Text style={styles.body}>{page.bodyHtml}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: palette.mist, flexGrow: 1 },
  heading: { fontSize: 24, fontWeight: "800", color: palette.navy, marginBottom: 12 },
  editButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  editButtonText: { color: palette.teal, fontWeight: "800" },
  error: { color: palette.muted, marginTop: 16 },
  body: { fontSize: 15, lineHeight: 22, color: palette.ink },
});
