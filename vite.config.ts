import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const BASE_PATH = process.env.NODE_ENV === "production"
  ? "/crewing/"
  : "/";

function authEnvGuard(): Plugin {
  return {
    name: "auth-env-guard",
    buildStart() {
      if (process.env.NODE_ENV !== "production") return;
      if (process.env.VITE_AUTH_BYPASS === "true") return;
      if (!process.env.VITE_PARENT_LOGIN_URL) {
        throw new Error(
          "VITE_PARENT_LOGIN_URL is not set for production build. " +
            "Set VITE_PARENT_LOGIN_URL to the parent app login URL, " +
            "or set VITE_AUTH_BYPASS=true to skip this check.",
        );
      }
    },
  };
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    runtimeErrorOverlay(),
    authEnvGuard(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    assetsDir: "assets",
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
