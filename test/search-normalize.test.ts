import { describe, it, expect } from "vitest";
import { normalizeSearchText } from "../apps/website/src/frontend/lib/cms";

describe("normalizeSearchText", () => {
  it("folds subscript digits so a typed CO2 reaches the CO₂ article", () => {
    // This is the bug it exists for: /blog/co2-fuel-cells is titled
    // "CO₂ Fuel Cells" and searching "CO2 fuel cell" returned nothing.
    expect(normalizeSearchText("CO₂ Fuel Cells")).toBe("co2 fuel cells");
    expect(normalizeSearchText("H₂O")).toBe("h2o");
    expect(normalizeSearchText("CO₂ Fuel Cells")).toContain(normalizeSearchText("co2"));
  });

  it("strips diacritics", () => {
    expect(normalizeSearchText("Café")).toBe("cafe");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeSearchText("  Reference   ELECTRODE ")).toBe("reference electrode");
  });

  it("leaves catalogue notation that carries meaning intact", () => {
    // Ø and × are how the sizes are actually written; folding them away would
    // make "Ø6 × 140 mm" unsearchable by its own label.
    const out = normalizeSearchText("Ø6 × 140 mm");
    expect(out).toContain("6");
    expect(out).toContain("140");
  });

  it("is idempotent — normalising twice changes nothing", () => {
    const once = normalizeSearchText("CO₂ Café  ");
    expect(normalizeSearchText(once)).toBe(once);
  });
});
