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
