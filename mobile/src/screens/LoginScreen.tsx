import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../auth/AuthContext";

const loginBackground = require("../../assets/login-ocean.png");

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier.trim(), password, domain.trim());
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ImageBackground
      source={loginBackground}
      resizeMode="cover"
      style={styles.background}
      imageStyle={Platform.OS === "web" ? styles.webBackgroundImage : undefined}
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.eyebrow}>SAIL CREW</Text>
            <Text style={styles.title}>Welcome aboard</Text>
            <Text style={styles.subtitle}>Sign in to continue to your crew portal</Text>

            <Text style={styles.label}>Emp No / Mobile / Email</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="K 1003"
              placeholderTextColor="#718096"
              testID="login-identifier"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor="#718096"
              testID="login-password"
            />

            <Text style={styles.label}>Domain</Text>
            <TextInput
              style={styles.input}
              value={domain}
              onChangeText={setDomain}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="company domain"
              placeholderTextColor="#718096"
              testID="login-domain"
            />

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                submitting && styles.buttonDisabled,
              ]}
              onPress={onSubmit}
              disabled={submitting}
              testID="login-submit"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%" },
  webBackgroundImage: { height: "160%", top: "-30%" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(4, 35, 57, 0.12)",
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 36,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 26,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.91)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    ...Platform.select({
      ios: {
        shadowColor: "#052e4f",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
      web: { boxShadow: "0 16px 48px rgba(5, 46, 79, 0.22)" },
    }),
  },
  eyebrow: {
    color: "#0b6a8f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.2,
    textAlign: "center",
    marginBottom: 7,
  },
  title: {
    color: "#073451",
    fontSize: 27,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: "#526575",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 15,
    textAlign: "center",
  },
  label: {
    color: "#26495f",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#b8cbd6",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    color: "#102f43",
    fontSize: 16,
  },
  errorContainer: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#fff0f0",
  },
  error: { color: "#a61b1b", fontSize: 13, lineHeight: 18 },
  button: {
    minHeight: 50,
    marginTop: 20,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#087ea4",
  },
  buttonPressed: { backgroundColor: "#066b8c" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
});
