import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  test: {
    exclude: [...configDefaults.exclude, "**/local/**", "**/.cargo-target/**"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        "**/.git/**",
        "**/local/**",
        "**/.cargo-target/**",
        "**/node_modules/**",
        "**/.venv-adapters/**",
        "**/dist/**",
        "**/data/**",
        "**/Assets/**",
        "**/adapters/**",
        "**/artifacts/**",
        "**/scratch/**",
      ],
    },
  },
});
