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
 * prove nothing about the real path. Package resolution, not a Payload boot —
 * no config is read, no database is opened.
 *
 * It is LOAD-BEARING FOR THE WHOLE test/ DIRECTORY, not for one file. Several
 * suites import real collection configs, and any of those chains can reach
 * lib/staff-error.ts. Trimming this as "only staff-errors.test.ts needs it"
 * takes those suites down with it.
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
