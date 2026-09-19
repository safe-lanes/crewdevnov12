import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { palette, Button } from "./CrewUI";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render-time exceptions anywhere below it in the tree so a single
// bad screen shows a recoverable fallback instead of a white/frozen screen.
// Does NOT catch errors in event handlers or promises — see
// ErrorUtils.setGlobalHandler in src/globalErrorHandler.ts for those.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled render error", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <View style={styles.mark}><Text style={styles.markText}>!</Text></View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app hit an unexpected error. You can try again — if it keeps happening, please let us know.
          </Text>
          <Button title="Try again" onPress={this.reset} />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.mist, padding: 28 },
  mark: { width: 62, height: 62, borderRadius: 20, backgroundColor: palette.red, alignItems: "center", justifyContent: "center" },
  markText: { color: palette.white, fontSize: 28, fontWeight: "900" },
  title: { color: palette.navy, fontSize: 19, fontWeight: "800", marginTop: 16, textAlign: "center" },
  message: { color: palette.muted, marginTop: 8, textAlign: "center", lineHeight: 20 },
});
