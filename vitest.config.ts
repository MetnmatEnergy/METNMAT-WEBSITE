import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/**
 * Root test runner. Tests live in `test/` and import source via relative paths,
 * so the apps' own `tsc`/`next build` never see them (no test-type pollution).
 *
 * Nearly everything under test is pure — magic-byte validation, timing-safe key
 * compare, rate-limit math, stock arithmetic, access decisions, the CMS workflow
 * gates. Those files import Payload for TYPES only, which erases at compile time,
 * so no Payload runtime is loaded.
 *
 * The `payload` alias below is the one exception, and it exists because
 * lib/staff-error.ts imports `APIError` as a VALUE. That is deliberate: whether
 * a refusal reaches the staff member's screen depends on Payload's own
 * isErrorPublic(), and asserting that against a hand-rolled look-alike would
 * prove nothing about the real path. The cost is ~1s of import time in the one
 * test file that touches it. Package resolution, not a Payload boot — no config
 * is read, no database is opened.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/website/src", import.meta.url)),
      payload: fileURLToPath(new URL("./apps/dashboard/node_modules/payload", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    clearMocks: true,
  },
});
