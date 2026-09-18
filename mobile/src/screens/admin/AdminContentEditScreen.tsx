import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { contentApi, ContentPageKey } from "../../api/contentApi";
import { palette } from "../../components/CrewUI";

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
        <ActivityIndicator color={palette.teal} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Edit {TITLES[pageKey]}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput accessibilityLabel="Page title" style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Content</Text>
      <TextInput
        accessibilityLabel="Page content"
        style={[styles.input, styles.textArea]}
        value={bodyHtml}
        onChangeText={setBodyHtml}
        multiline
        textAlignVertical="top"
      />

      {error ? <Text accessibilityLiveRegion="assertive" role="alert" style={styles.error}>{error}</Text> : null}

      <Pressable accessibilityRole="button" accessibilityLabel={saving ? "Saving page" : "Save page"} accessibilityState={{ disabled: saving, busy: saving }} style={[styles.button, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.mist },
  container: { padding: 20, backgroundColor: palette.mist, flexGrow: 1 },
  heading: { fontSize: 24, fontWeight: "800", color: palette.navy, marginBottom: 16 },
  label: { fontSize: 13, color: palette.ink, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, color: palette.ink, borderRadius: 10, padding: 12, fontSize: 15 },
  textArea: { minHeight: 200 },
  error: { color: palette.red, marginTop: 12 },
  button: { marginTop: 24, minHeight: 50, backgroundColor: palette.teal, borderRadius: 11, paddingHorizontal: 14, justifyContent: "center", alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: palette.white, fontSize: 16, fontWeight: "800" },
});
