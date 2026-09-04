import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { APIError } from "payload";
import { staffError } from "../apps/dashboard/src/lib/staff-error";

/**
 * A refusal the staff member never sees is a refusal that did not happen.
 *
 * WHAT WAS BROKEN. Twenty-two guards threw a bare `Error` carrying a sentence
 * written for the person in the admin — "Attach the quotation PDF before marking
 * it Sent", "That PIN is already in use", the category-delete refusal naming how
 * many products still point at it. Payload replaces the message of any error it
 * does not consider public, and a plain Error is never public, so every one of
 * them rendered as "Something went wrong."
 *
 * Nothing failed loudly. The guards worked; only their explanations were thrown
 * away. That is worse than a missing guard, because the person is told they may
 * not proceed and not told what to change.
 *
 * The last block asserts the mechanism against the INSTALLED payload rather than
 * against a description of it, so an upgrade that changes how errors are
 * published fails here instead of silently muting the messages again.
 */

const CMS = join(__dirname, "..", "apps", "dashboard", "src");
const read = (p: string) => readFileSync(join(CMS, p), "utf8");
const PAYLOAD = join(__dirname, "..", "apps", "dashboard", "node_modules", "payload", "dist");

/** Every file whose throws are addressed to a human in the admin. */
const STAFF_FACING = [
  "hooks/category-guards.ts",
  "hooks/order-workflow.ts",
  "hooks/workflow-gates.ts",
  "hooks/product-image-spec.ts",
  "collections/Users.ts",
];

/** Failures the caller should NOT be told about, and the logs should be. */
const INTERNAL = ["hooks/customer-code.ts", "hooks/analytics-ingest.ts"];

describe("staffError produces an error Payload will actually show", () => {
  it("is an APIError — a plain Error is silently rewritten", () => {
    expect(staffError("Attach the quotation PDF before marking it Sent.")).toBeInstanceOf(APIError);
  });

  it("carries the message unchanged", () => {
    const msg = "That PIN is already in use — choose a different 4-digit PIN.";
    expect(staffError(msg).message).toBe(msg);
  });

  it("is 400, not 500 — a staff member mistyping a PIN is not a server fault", () => {
    expect(staffError("x").status).toBe(400);
  });

  it("marks itself public explicitly, so the status alone is not load-bearing", () => {
    expect((staffError("x") as unknown as { isPublic: boolean }).isPublic).toBe(true);
  });
});

describe("every staff-facing guard uses it", () => {
  it.each(STAFF_FACING)("%s throws no bare Error", (file) => {
    // A bare `throw new Error` here means a message written for someone that
    // they will never read.
    expect(read(file)).not.toMatch(/throw new Error\(/);
  });

  it.each(STAFF_FACING)("%s imports the helper", (file) => {
    expect(read(file)).toMatch(/import \{ staffError \} from "\.\.\/lib\/staff-error"/);
  });

  it("covers all twenty-two messages", () => {
    const total = STAFF_FACING.reduce(
      (n, f) => n + (read(f).match(/throw staffError\(/g) ?? []).length,
      0,
    );
    expect(total).toBe(22);
  });

  it("keeps the specific sentences, rather than collapsing them into one", () => {
    // The value is in the specificity. A single "Invalid request" would satisfy
    // the checks above and help nobody.
    const gates = read("hooks/workflow-gates.ts");
    expect(gates).toMatch(/Attach the quotation PDF before marking it Sent\./);
    expect(gates).toMatch(/Add a loss reason before marking this RFQ Lost\./);
    expect(read("collections/Users.ts")).toMatch(/PIN must be exactly 4 digits/);
    expect(read("hooks/order-workflow.ts")).toMatch(/Invalid order status change/);
  });
});

describe("internal failures stay opaque", () => {
  it.each(INTERNAL)("%s still throws a bare Error deliberately", (file) => {
    // A counter that would not allocate, and a malformed payload on the public
    // analytics ingest. Neither is a staff member doing something reasonable,
    // and neither should describe the internals to whoever called it.
    expect(read(file)).toMatch(/throw new Error\(/);
    expect(read(file)).not.toMatch(/staffError/);
  });
});

describe("the Payload behaviour this depends on still holds", () => {
  const isErrorPublic = readFileSync(join(PAYLOAD, "utilities/isErrorPublic.js"), "utf8");
  const routeError = readFileSync(join(PAYLOAD, "utilities/routeError.js"), "utf8");

  it("an error that is not public has its message replaced", () => {
    // This is the line that ate twenty-two messages.
    expect(routeError).toMatch(/if \(!isErrorPublic\(err, config\)\)/);
    expect(routeError).toMatch(/formatErrors\(new APIError\('Something went wrong\.'\)\)/);
  });

  it("isPublic:true publishes the message", () => {
    expect(isErrorPublic).toMatch(/if \(payloadError\.isPublic === true\) \{\s*return true;/);
  });

  it("a non-500 status publishes it too", () => {
    expect(isErrorPublic).toMatch(
      /payloadError\.status && payloadError\.status !== httpStatus\.INTERNAL_SERVER_ERROR/,
    );
  });

  it("and an error with neither is NOT public — which is what a bare Error is", () => {
    // The function ends `return false`, so anything that reaches the bottom is
    // muted. A plain Error sets no status and no isPublic, so it always does.
    expect(isErrorPublic.trimEnd()).toMatch(/return false;\s*\}\s*(\/\/#.*)?$/);
  });
});

describe("no new bare throws creep back into the hooks", () => {
  it("only the two internal ones remain across every hook", () => {
    const dir = join(CMS, "hooks");
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      if (/throw new Error\(/.test(src)) offenders.push(`hooks/${f}`);
    }
    expect(offenders.sort()).toEqual(INTERNAL.slice().sort());
  });
});
