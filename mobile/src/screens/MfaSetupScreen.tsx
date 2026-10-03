import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { authApi } from "../api/authApi";
import { palette } from "../components/CrewUI";

export default function MfaSetupScreen() {
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = async () => {
    setBusy(true); setError(null);
    try { setSecret((await authApi.beginMfa()).secret); } catch (e: any) { setError(e?.message ?? "Unable to start setup"); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setError(null);
    try { setRecoveryCodes((await authApi.confirmMfa(code.trim())).recoveryCodes); } catch (e: any) { setError(e?.message ?? "Unable to confirm setup"); }
    finally { setBusy(false); }
  };

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Authenticator app</Text>
    {recoveryCodes.length ? <View style={styles.card}>
      <Text style={styles.heading}>Save these one-time recovery codes</Text>
      <Text style={styles.warning}>They will not be shown again. Store them somewhere private.</Text>
      {recoveryCodes.map(value => <Text key={value} selectable style={styles.code}>{value}</Text>)}
    </View> : !secret ? <>
      <Text style={styles.body}>Add a second sign-in step using any TOTP authenticator app.</Text>
      <Pressable style={styles.button} onPress={begin} disabled={busy}><Text style={styles.buttonText}>Start setup</Text></Pressable>
    </> : <View style={styles.card}>
      <Text style={styles.heading}>Enter this key in your authenticator</Text>
      <Text selectable style={styles.secret}>{secret}</Text>
      <Text style={styles.body}>Then enter the current 6-digit code to verify setup.</Text>
      <TextInput accessibilityLabel="Authenticator code" style={styles.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <Pressable style={styles.button} onPress={confirm} disabled={busy || code.length !== 6}><Text style={styles.buttonText}>Verify and enable</Text></Pressable>
    </View>}
    {busy ? <ActivityIndicator color={palette.teal} /> : null}
    {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: palette.mist },
  title: { fontSize: 24, fontWeight: "900", color: palette.navy, marginBottom: 12 },
  card: { padding: 18, borderRadius: 13, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line },
  heading: { fontSize: 17, fontWeight: "800", color: palette.ink, marginBottom: 10 },
  body: { color: palette.ink, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  warning: { color: palette.red, marginBottom: 12 },
  secret: { fontFamily: "monospace", fontSize: 17, letterSpacing: 2, color: palette.navy, marginBottom: 16 },
  code: { fontFamily: "monospace", fontSize: 17, color: palette.navy, marginVertical: 3 },
  input: { height: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 10, paddingHorizontal: 14, backgroundColor: palette.white, fontSize: 18, marginBottom: 12 },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: palette.teal, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  buttonText: { color: palette.white, fontWeight: "800", fontSize: 15 },
  error: { color: palette.red, marginTop: 10 },
});
