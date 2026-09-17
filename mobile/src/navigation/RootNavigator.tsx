import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../auth/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import SetPasswordScreen from "../screens/SetPasswordScreen";
import MainTabs from "./MainTabs";
import { palette } from "../components/CrewUI";

export default function RootNavigator() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <View style={styles.brandMark}><Text style={styles.brandText}>SC</Text></View>
        <Text style={styles.title}>SAIL Crew</Text>
        <ActivityIndicator color={palette.teal} style={styles.loader} />
      </View>
    );
  }
  if (status === "loggedOut") return <LoginScreen />;
  if (status === "mustResetPassword") return <SetPasswordScreen />;
  return <MainTabs />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.mist },
  brandMark: { width: 62, height: 62, borderRadius: 20, backgroundColor: palette.navy, alignItems: "center", justifyContent: "center" },
  brandText: { color: "#A4DFDB", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  title: { color: palette.navy, fontSize: 18, fontWeight: "800", marginTop: 14 },
  loader: { marginTop: 18 },
});
