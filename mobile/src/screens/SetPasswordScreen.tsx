import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../components/CrewUI";

export default function SetPasswordScreen() {
  const { setPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await setPassword(currentPassword, newPassword);
    } catch (err: any) {
      setError(err?.message ?? "Failed to set password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set a New Password</Text>
      <Text style={styles.subtitle}>Create a password to continue.</Text>

      <Text style={styles.label}>Current / Temporary Password</Text>
      <TextInput
        style={styles.input}
        accessibilityLabel="Current or temporary password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        testID="setpw-current"
      />

      <Text style={styles.label}>New Password</Text>
      <TextInput
        style={styles.input}
        accessibilityLabel="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        testID="setpw-new"
      />

      <Text style={styles.label}>Confirm New Password</Text>
      <TextInput
        style={styles.input}
        accessibilityLabel="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        testID="setpw-confirm"
      />

      {error ? <Text accessibilityLiveRegion="assertive" role="alert" style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitting ? "Setting password" : "Set password"}
        accessibilityState={{ disabled: submitting, busy: submitting }}
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={submitting}
        testID="setpw-submit"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Set Password</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: palette.mist },
  title: { fontSize: 27, fontWeight: "800", color: palette.navy, marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: palette.muted, textAlign: "center", marginBottom: 16 },
  label: { fontSize: 13, color: palette.ink, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 10, paddingHorizontal: 14, backgroundColor: palette.white, color: palette.ink, fontSize: 16 },
  error: { color: palette.red, marginTop: 12 },
  button: { minHeight: 50, marginTop: 24, backgroundColor: palette.teal, borderRadius: 11, paddingHorizontal: 14, justifyContent: "center", alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: palette.white, fontSize: 16, fontWeight: "800" },
});
