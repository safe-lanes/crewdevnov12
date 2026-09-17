import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { contentApi, ContentPage, ContentPageKey } from "../api/contentApi";
import { useAuth } from "../auth/AuthContext";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contentApi.getPage(pageKey);
      setPage(data);
    } catch (err: any) {
      if (err?.message === "Content page not found") {
        setError("This page hasn't been set up yet.");
      } else {
        setError(err?.message ?? "Failed to load page");
      }
    } finally {
      setLoading(false);
    }
  }, [pageKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{TITLES[pageKey]}</Text>
      {isAdmin ? (
        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate("AdminContentEdit", { pageKey })}
          testID="edit-content-button"
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      ) : null}

      {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && page ? <Text style={styles.body}>{page.bodyHtml}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  editButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#0a5",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  editButtonText: { color: "#0a5", fontWeight: "600" },
  error: { color: "#666", marginTop: 16 },
  body: { fontSize: 15, lineHeight: 22, color: "#222" },
});
