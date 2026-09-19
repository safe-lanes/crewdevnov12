import { Platform } from "react-native";

// The managed Replit workflow supplies the crew web/API's mapped HTTPS
// development origin. Local web development uses port 5001; native devices
// must supply a reachable LAN URL.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === "web" ? "http://localhost:5001" : "");

if (!API_BASE_URL) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL is required for native device testing");
}

// EXPO_PUBLIC_* values are baked into the bundle at build time — a
// misconfigured production build would otherwise ship credentials and
// bearer tokens over plaintext HTTP with no runtime warning. __DEV__ is a
// real React Native/Expo global (false in a release build).
if (!__DEV__ && !API_BASE_URL.startsWith("https://")) {
  throw new Error(`API_BASE_URL must use https:// in a production build (got "${API_BASE_URL}").`);
}
