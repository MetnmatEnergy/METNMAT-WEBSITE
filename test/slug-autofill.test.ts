import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Products } from "../apps/dashboard/src/collections/Products";
import { Categories } from "../apps/dashboard/src/collections/Categories";
import { Services } from "../apps/dashboard/src/collections/Services";
import { Projects } from "../apps/dashboard/src/collections/Projects";
import { Posts } from "../apps/dashboard/src/collections/Posts";
import type { Field } from "payload";

/**
 * A required field the staff member is told to leave blank.
 *
 * `slug` is `required: true` and its description says it is generated from the
 * name when blank. Both cannot be true from the admin, and the admin is the
 * only place staff work:
 *
 *   payload/dist/fields/validations.js  (text)
 *     if (required) { if (!value || value.length === 0) return t('validation:required') }
 *   @payloadcms/ui/dist/forms/Form/index.js:285
 *     if (!isValid_2) { errorToast(t('error:correctInvalidFields')); ... return }
 *
 * The client refuses to submit, so the request never reaches the server and the
 * beforeValidate hook that derives the slug never runs. A staff member who does
 * what the help text says gets "Please correct invalid fields" and no product.
 * Every product in the catalogue arrived through the importer or the seed, both
 * of which supply a slug — which is why nobody had hit this.
 *
 * These tests run the REAL validators off the REAL collection configs.
 */

/** Walk tabs/rows/groups to find a named field, wherever it is nested. */
function findField(fields: Field[], name: string): Field | undefined {
  for (const f of fields) {
    if ("name" in f && f.name === name) return f;
    const nested =
      ("fields" in f && (f.fields as Field[])) ||
      ("tabs" in f && (f.tabs as { fields: Field[] }[]).flatMap((t) => t.fields)) ||
      null;
    if (nested) {
      const hit = findField(nested as Field[], name);
      if (hit) return hit;
    }
  }
  return undefined;
}

const slugField = (c: { fields: Field[] }, name = "slug") => {
  const f = findField(c.fields, name);
  expect(f, `${name} field not found`).toBeDefined();
  return f as Field & { required?: boolean; validate?: (v: unknown, a: unknown) => unknown };
};

const cases: Array<[string, { fields: Field[] }, string]> = [
  ["Products", Products as unknown as { fields: Field[] }, "Reference Electrode Ag/AgCl"],
  ["Categories", Categories as unknown as { fields: Field[] }, "Crucibles & Boats"],
];

describe.each(cases)("%s.slug accepts the blank the help text invites", (label, config, name) => {
  const field = slugField(config);
  const run = (value: unknown, data: unknown) =>
    field.validate!(value, { data } as unknown);

  it("is still declared required — the guarantee is not being dropped", () => {
    // seed's cleanupMalformed() DELETES rows with an empty slug on boot, so a
    // document that slipped through without one would silently disappear.
    expect(field.required).toBe(true);
  });

  it("accepts an empty slug when there is a name to derive one from", () => {
    expect(run("", { name })).toBe(true);
    expect(run(undefined, { name })).toBe(true);
    expect(run(null, { name })).toBe(true);
  });

  it("accepts a whitespace-only slug the same way", () => {
    expect(run("   ", { name })).toBe(true);
  });

  it("accepts a slug that was typed in", () => {
    expect(run("reference-electrode", { name })).toBe(true);
  });

  it("REFUSES when neither the slug nor a usable name is present", () => {
    // Otherwise the row saves with an empty slug and the boot seed deletes it.
    expect(run("", { name: "" })).toBeTypeOf("string");
    expect(run("", {})).toBeTypeOf("string");
    expect(run("", undefined)).toBeTypeOf("string");
  });

  it("REFUSES a name that yields nothing sluggable", () => {
    // "!!!" slugifies to "", so the derived slug would be empty too.
    expect(run("", { name: "!!!" })).toBeTypeOf("string");
    expect(run("", { name: "   " })).toBeTypeOf("string");
  });

  it("says what to do, rather than 'This field is required'", () => {
    const msg = run("", { name: "" }) as string;
    expect(msg).toMatch(/name it can be made from/);
  });
});

describe("the hook that fills it still exists", () => {
  // The validator permits a blank precisely BECAUSE this runs next. Delete the
  // hook and the validator becomes a hole rather than a convenience.
  const read = (p: string) =>
    readFileSync(join(__dirname, "..", "apps", "dashboard", "src", p), "utf8");

  it.each([
    ["Products", "collections/Products.ts"],
    ["Categories", "collections/Categories.ts"],
  ])("%s derives the slug in beforeValidate", (_l, file) => {
    const src = read(file);
    expect(src).toMatch(/beforeValidate: \[\s*\(\{ value, data \}\)/);
    expect(src).toMatch(/slugify\(\(value as string\) \|\| \(data\?\.name as string\) \|\| ""\)/);
  });
});

/**
 * The same defect existed in five collections, with two different severities.
 *
 * Products, Projects and Posts have `versions.drafts`, so SaveDraftButton
 * submits with skipValidation:true — staff could Save draft, watch the slug
 * appear, then Publish. Annoying, survivable.
 *
 * Categories and Services have NO versions key, so the admin renders a plain
 * Save button that validates. EVERY save was refused, with no button to press
 * instead. Categories is the one that mattered most: the "+" beside the Category
 * picker on the product form opens it in the middle of adding a product.
 */
describe("every slug field in the CMS accepts the blank its help text invites", () => {
  const CASES: Array<[string, { fields: Field[] }, string, string]> = [
    ["Products", Products as never, "name", "Reference Electrode"],
    ["Categories", Categories as never, "name", "Crucibles"],
    ["Services", Services as never, "title", "Failure Analysis"],
    ["Projects", Projects as never, "title", "Heat Treatment Study"],
    ["Posts", Posts as never, "title", "Why Electrodes Drift"],
  ];

  it.each(CASES)("%s.slug accepts empty when %s is set", (_label, config, source, value) => {
    const f = slugField(config);
    expect(f.validate!("", { data: { [source]: value } } as never)).toBe(true);
  });

  it.each(CASES)("%s.slug still refuses when there is nothing to derive from", (_l, config) => {
    const f = slugField(config);
    expect(f.validate!("", { data: {} } as never)).toBeTypeOf("string");
  });

  it.each(CASES)("%s.slug is still declared required", (_l, config) => {
    expect(slugField(config).required).toBe(true);
  });

  it("the two WITHOUT drafts are covered — they had no Save-draft escape hatch", () => {
    // If either grows a versions key later this assertion is merely stale, not
    // wrong; if either LOSES its validator, the collection becomes unsaveable.
    for (const c of [Categories, Services] as Array<{ versions?: unknown; fields: Field[] }>) {
      expect(c.versions).toBeUndefined();
      expect(slugField(c).validate).toBeTypeOf("function");
    }
  });
});
