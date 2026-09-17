import { Platform } from "react-native";

// Set EXPO_PUBLIC_API_BASE_URL to the machine's LAN/HTTPS address for physical
// devices. Web development uses the crew web app/API on port 5000.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === "web" ? "http://localhost:5000" : "http://192.168.156.62:5000");
