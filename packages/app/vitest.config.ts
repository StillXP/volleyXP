import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Pure bracket structure, shared with the UI; resolved from source like Next does.
      "@design-system/bracket-model": path.resolve(__dirname, "../design-system/src/bracket-model/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
