import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { readOptions } from "../apps/website/src/frontend/lib/select-options";

// React belongs to the website package, not the repo root these tests run from.
const { createElement: h, Fragment } = createRequire(new URL("../apps/website/package.json", import.meta.url))("react") as typeof import("react");

const root = fileURLToPath(new URL("../apps/website/src", import.meta.url));

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? tsxFiles(path) : e.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("dropdowns", () => {
  it("are all the shared one, so none falls back to the browser's plain list", () => {
    const stray = tsxFiles(root)
      .filter((f) => !f.endsWith(join("ui", "select.tsx")))
      .filter((f) => /<select\s/.test(readFileSync(f, "utf8")));
    expect(stray).toEqual([]);
  });

  it("read a plain option list", () => {
    const { groups, placeholder } = readOptions([h("option", { key: 1, value: "a" }, "Apple"), h("option", { key: 2, value: "b" }, "Bean")]);
    expect(placeholder).toBeUndefined();
    expect(groups).toHaveLength(1);
    expect(groups[0].options.map((o) => [o.value, o.label])).toEqual([["a", "Apple"], ["b", "Bean"]]);
  });

  it("treat a disabled empty option as the placeholder, not a choice", () => {
    const { groups, placeholder } = readOptions([h("option", { key: 0, value: "", disabled: true }, "Select an option"), h("option", { key: 1, value: "x" }, "X")]);
    expect(placeholder).toBe("Select an option");
    expect(groups[0].options.map((o) => o.value)).toEqual(["x"]);
  });

  it("keep an enabled empty option, because All is a real choice in the blog filters", () => {
    const { groups, placeholder } = readOptions([h("option", { key: 0, value: "" }, "All"), h("option", { key: 1, value: "x" }, "X")]);
    expect(placeholder).toBeUndefined();
    expect(groups[0].options.map((o) => o.label)).toEqual(["All", "X"]);
  });

  it("read groups, fragments, the data extras, and text built from pieces", () => {
    const { groups } = readOptions(
      h(
        Fragment,
        null,
        h("option", { value: "first" }, "First"),
        h("optgroup", { label: "Length", "data-hint": "Short ones", "data-tile": "L" }, h("option", { value: "mm", "data-detail": "0.001 m" }, "mm"), h("option", { value: "cm", lang: "fr" }, "c", "m")),
      ),
    );
    expect(groups.map((g) => g.label)).toEqual([undefined, "Length"]);
    expect(groups[1]).toMatchObject({ hint: "Short ones", tile: "L" });
    expect(groups[1].options[0].detail).toBe("0.001 m");
    expect(groups[1].options[1]).toMatchObject({ label: "cm", lang: "fr" });
  });

  it("use the option's text as its value when it has none, as a native select does", () => {
    expect(readOptions(h("option", null, "Only")).groups[0].options[0].value).toBe("Only");
  });
});
