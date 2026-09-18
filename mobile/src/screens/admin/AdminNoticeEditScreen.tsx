import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { noticesApi } from "../../api/noticesApi";
import { palette } from "../../components/CrewUI";

export default function AdminNoticeEditScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const noticeUuid: string | undefined = route.params?.noticeUuid;
  const isEdit = !!noticeUuid;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!noticeUuid) return;
      let cancelled = false;
      setLoading(true);
      noticesApi
        .get(noticeUuid)
        .then((n) => {
          if (cancelled) return;
          setTitle(n.title);
          setBody(n.body);
          setIsPublished(!!n.isPublished);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [noticeUuid]),
  );

  const onSave = async () => {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await noticesApi.update(noticeUuid!, { title, body, isPublished });
      } else {
        await noticesApi.create({ title, body, isPublished });
      }
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save notice");
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
      <Text style={styles.heading}>{isEdit ? "Edit Notice" : "New Notice"}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput accessibilityLabel="Notice title" style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Body</Text>
      <TextInput
        accessibilityLabel="Notice body"
        style={[styles.input, styles.textArea]}
        value={body}
        onChangeText={setBody}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.row}>
        <Text style={styles.label}>Published</Text>
        <Switch accessibilityLabel="Published" value={isPublished} onValueChange={setIsPublished} />
      </View>

      {error ? <Text accessibilityLiveRegion="assertive" role="alert" style={styles.error}>{error}</Text> : null}

      <Pressable accessibilityRole="button" accessibilityLabel={saving ? "Saving notice" : "Save notice"} accessibilityState={{ disabled: saving, busy: saving }} style={[styles.button, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
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
  textArea: { minHeight: 150 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  error: { color: palette.red, marginTop: 12 },
  button: { marginTop: 24, minHeight: 50, backgroundColor: palette.teal, borderRadius: 11, paddingHorizontal: 14, justifyContent: "center", alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: palette.white, fontSize: 16, fontWeight: "800" },
});
