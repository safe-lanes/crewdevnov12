// Runs before any test module loads. src/config.ts throws at import time if
// this isn't set on native platforms — tests run under the "ios" Platform.OS
// jest-expo defaults to, so it needs a value here same as a real device build.
process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:5001";
