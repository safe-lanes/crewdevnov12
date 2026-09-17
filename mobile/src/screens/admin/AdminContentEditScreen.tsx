import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { contentApi, ContentPageKey } from "../../api/contentApi";

const TITLES: Record<ContentPageKey, string> = {
  about_us: "About Us",
  contact_us: "Contact Us",
  forum: "Forum",
};

export default function AdminContentEditScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const pageKey: ContentPageKey = route.params.pageKey;

  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      contentApi
        .getPage(pageKey)
        .then((page) => {
          if (cancelled) return;
          setTitle(page.title ?? TITLES[pageKey]);
          setBodyHtml(page.bodyHtml ?? "");
        })
        .catch(() => {
          // Not authored yet — start from a blank form.
          if (!cancelled) setTitle(TITLES[pageKey]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [pageKey]),
  );

  const onSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await contentApi.upsertPage(pageKey, { title, bodyHtml, isPublished: true });
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Edit {TITLES[pageKey]}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Content</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bodyHtml}
        onChangeText={setBodyHtml}
        multiline
        textAlignVertical="top"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 20 },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 13, color: "#555", marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 15 },
  textArea: { minHeight: 200 },
  error: { color: "#c00", marginTop: 12 },
  button: { marginTop: 24, backgroundColor: "#0a5", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
