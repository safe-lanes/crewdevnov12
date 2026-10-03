import { Platform } from "react-native";

// EXPO_PUBLIC_API_BASE_URL_WEB takes priority on web only, so a physical-device
// LAN URL (EXPO_PUBLIC_API_BASE_URL) and a local web preview target can be
// configured at the same time from the same .env. The managed Replit workflow
// supplies EXPO_PUBLIC_API_BASE_URL as the crew web/API's mapped HTTPS
// development origin, which is why web still falls back to it before the
// localhost default. Native devices must supply a reachable LAN URL via
// EXPO_PUBLIC_API_BASE_URL.
export const API_BASE_URL =
  (Platform.OS === "web" ? process.env.EXPO_PUBLIC_API_BASE_URL_WEB : undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === "web" ? "http://localhost:5000" : "");

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
if (!__DEV__ && (/REPLACE_WITH_/i.test(API_BASE_URL) || /https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(API_BASE_URL))) {
  throw new Error("API_BASE_URL contains a placeholder or local development host in a production build.");
}
