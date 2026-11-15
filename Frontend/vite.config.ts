import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { normalizePath, type Plugin } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startObsidianSync } from "../scripts/obsidian/sync.mjs";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function obsidianMemoryVault(): Plugin {
  let close = async () => {};
  return {
    name: "alice-obsidian-memory",
    apply: (config, environment) => environment.command === "serve" && config.mode !== "test" && !process.env.VITEST,
    configureServer(server) {
      const sync = startObsidianSync({ projectRoot });
      close = () => sync.close();
      server.httpServer?.once("close", () => { void close(); });
    },
    async closeBundle() { await close(); },
  };
}

export default defineConfig({
  root: frontendRoot,
  envDir: projectRoot,
  plugins: [react(), obsidianMemoryVault(), {
    name: "alice-private-development-files",
    config(config) {
      const root = path.resolve(config.root ?? frontendRoot);
      // npm hoists dependencies to the repository. Private siblings must remain
      // denied even when Vite permits reading that workspace's node_modules.
      const privateRoots = [...new Set([projectRoot, root, ...(path.basename(root).toLowerCase() === "frontend" ? [path.dirname(root)] : [])])];
      return { server: { fs: { allow: [root, path.join(projectRoot, "node_modules")], deny: [
        ".env", ".env.*", "*.{crt,pem,key,p12,pfx,cer,der}", ".npmrc", ".yarnrc.yml", "**/.git/**",
        ...privateRoots.flatMap(base => ["data", "local", ".cargo-target", ".venv-adapters", "Assets", "adapters", "artifacts", "scratch", "experiments"]
          .map(directory => `${normalizePath(path.join(base, directory))}/**`)),
      ] } } };
    },
  }],
  worker: { format: "es" },
  test: {
    exclude: [...configDefaults.exclude, "**/local/**", "**/.cargo-target/**", "**/*.node.test.ts", "scripts/obsidian/**/*.test.mjs", "scripts/backups/**/*.test.mjs"],
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
