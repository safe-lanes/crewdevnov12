import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../auth/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import SetPasswordScreen from "../screens/SetPasswordScreen";
import MainTabs from "./MainTabs";

export default function RootNavigator() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (status === "loggedOut") return <LoginScreen />;
  if (status === "mustResetPassword") return <SetPasswordScreen />;
  return <MainTabs />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
});
