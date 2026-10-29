import path from "path";
import { defineConfig } from "vitest/config";

const designSystem = path.resolve(__dirname, "../design-system/src");

export default defineConfig({
  // Next compiles JSX itself; tests need the automatic runtime so files needn't import React.
  esbuild: { jsx: "automatic" },
  resolve: {
    // @lockin/* are symlinked from the Lock In repo; resolve their React from this workspace.
    preserveSymlinks: true,
    dedupe: ["react", "react-dom"],
    alias: {
      // Resolved from source, like Next does (see next.config.ts).
      "@design-system/bracket-model": path.join(designSystem, "bracket-model/index.ts"),
      "@design-system/components": path.join(designSystem, "index.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Lock In ships bundler-style ESM (extensionless imports); let Vite transform it.
    server: { deps: { inline: [/@lockin\//] } },
  },
});
