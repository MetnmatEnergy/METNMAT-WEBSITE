import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MALFORMED_PRODUCT_WHERE, cleanupMalformed } from "../apps/dashboard/src/seed";

/**
 * The boot seed could delete a staff member's unfinished draft.
 *
 * `cleanupMalformed` hard-deletes every product whose slug is empty or missing,
 * and it runs on EVERY boot — `seed.ts` calls it from the always-run half, and a
 * PM2 memory-restart is a boot. CLAUDE.md records it as the one unconditional
 * deletion in the seed.
 *
 * That is right for a PUBLISHED product: an empty slug means a broken public
 * URL. It is wrong for a draft, and a draft can reach that state:
 *
 *   - Save Draft submits with `skipValidation: true`
 *     (@payloadcms/ui SaveDraftButton), which skips the field `validate`
 *     functions — including `slugFromTitleValidator`, whose entire purpose is to
 *     refuse an unslugifiable name. Its own comment says so: "slugify() returns
 *     '' for a title with no usable characters ('!!!'), and a row saved with an
 *     empty slug is deleted by the boot seed — so that case has to be refused
 *     here". Save Draft is the path that walks around it.
 *   - The field's `beforeValidate` hook still runs and fills the slug from the
 *     name, but `slugify("")` and `slugify("!!!")` are both "", so a draft named
 *     with no usable characters — or saved before the name was typed — stores an
 *     empty slug.
 *
 * The work then disappears at the next restart, with a log line and no other
 * trace. The staff member is not told, and nothing they can see explains it.
 *
 * THE FIX. Drafts are excluded. A draft with an empty slug is unfinished work,
 * not a broken page: it is not public, and it cannot be published, because
 * publishing runs the validation that Save Draft skipped. The published case —
 * the one that actually breaks a URL — is untouched.
 */

describe("what the cleanup targets", () => {
  it("still removes an empty or missing slug", () => {
    const json = JSON.stringify(MALFORMED_PRODUCT_WHERE);
    expect(json).toContain('"slug"');
    expect(json).toContain('"equals":""');
    expect(json).toContain('"exists":false');
  });

  it("excludes drafts", () => {
    // The whole fix in one assertion.
    expect(JSON.stringify(MALFORMED_PRODUCT_WHERE)).toContain("draft");
  });

  it("uses not_equals, so a legacy row with no _status is still cleaned", () => {
    // Mongo's $ne matches documents where the field is absent, so products
    // written before drafts existed are still covered. `equals: "published"`
    // would have quietly stopped cleaning those.
    const clause = JSON.stringify(MALFORMED_PRODUCT_WHERE);
    expect(clause).toContain("not_equals");
    expect(clause, "must not narrow to published-only").not.toContain('"_status":{"equals":"published"}');
  });
});

describe("what it actually deletes", () => {
  const fake = () => {
    const del = vi.fn(async () => ({ docs: [] }));
    return {
      payload: { delete: del, logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } },
      del,
    };
  };

  it("issues one delete against products with the guarded predicate", async () => {
    const { payload, del } = fake();
    await cleanupMalformed(payload as never);
    expect(del).toHaveBeenCalledTimes(1);
    const args = del.mock.calls[0]?.[0] as { collection: string; where: unknown };
    expect(args.collection).toBe("products");
    expect(args.where).toEqual(MALFORMED_PRODUCT_WHERE);
  });

  it("a failure is swallowed rather than blocking boot", async () => {
    // Unchanged behaviour, pinned: the CMS must still come up.
    const payload = {
      delete: vi.fn(async () => {
        throw new Error("db down");
      }),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    };
    await expect(cleanupMalformed(payload as never)).resolves.toBeUndefined();
  });
});

describe("the reason the draft could get there at all", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

  it("Save Draft submits with validation skipped", () => {
    const src = read("apps/dashboard/node_modules/@payloadcms/ui/dist/elements/SaveDraftButton/index.js");
    expect(src).toMatch(/skipValidation: true/);
  });

  it("the slug validator that would have refused it is a field `validate`", () => {
    // Which is exactly what skipValidation skips.
    expect(read("apps/dashboard/src/lib/slug-validate.ts")).toMatch(/return `Enter a web address/);
  });

  it("slugify returns empty for a name with no usable characters", async () => {
    const { slugify } = await import("../apps/dashboard/src/lib/blog");
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("the cleanup still runs on every boot", () => {
    // Not weakened — only narrowed. If this stops running, published products
    // with broken URLs start accumulating instead.
    expect(read("apps/dashboard/src/seed.ts")).toMatch(/await cleanupMalformed\(payload\)/);
  });
});
