import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/**
 * Root test runner. Tests live in `test/` and import source via relative paths,
 * so the apps' own `tsc`/`next build` never see them (no test-type pollution).
 * The modules under test are pure (no Payload/Next boot): magic-byte validation,
 * timing-safe key compare, rate-limit math, and the CMS workflow gates.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./apps/website/src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    clearMocks: true,
  },
});
