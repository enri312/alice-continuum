import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { normalizePath } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), {
    name: "alice-private-development-files",
    config(config) {
      const root = path.resolve(config.root ?? fileURLToPath(new URL(".", import.meta.url)));
      return { server: { fs: { deny: [
        ".env", ".env.*", "*.{crt,pem,key,p12,pfx,cer,der}", ".npmrc", ".yarnrc.yml", "**/.git/**",
        ...["data", "local", ".cargo-target", ".venv-adapters", "Assets", "adapters", "artifacts", "scratch"]
          .map(directory => `${normalizePath(path.join(root, directory))}/**`),
      ] } } };
    },
  }],
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
