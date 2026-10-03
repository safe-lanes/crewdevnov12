import React, { useEffect } from "react";
import * as ScreenCapture from "expo-screen-capture";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { installGlobalErrorHandler } from "./src/globalErrorHandler";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { queryClient } from "./src/queryClient";
import { AuthProvider } from "./src/auth/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { mobileOutbox } from "./src/outbox/outbox";

installGlobalErrorHandler();
mobileOutbox.start();

export default function App() {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync("authenticated-content").catch(() => {});
    return () => { ScreenCapture.allowScreenCaptureAsync("authenticated-content").catch(() => {}); };
  }, []);
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
