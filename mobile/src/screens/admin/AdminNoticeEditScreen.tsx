import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { noticesApi } from "../../api/noticesApi";

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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{isEdit ? "Edit Notice" : "New Notice"}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Body</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={body}
        onChangeText={setBody}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.row}>
        <Text style={styles.label}>Published</Text>
        <Switch value={isPublished} onValueChange={setIsPublished} />
      </View>

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
  textArea: { minHeight: 150 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  error: { color: "#c00", marginTop: 12 },
  button: { marginTop: 24, backgroundColor: "#0a5", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
