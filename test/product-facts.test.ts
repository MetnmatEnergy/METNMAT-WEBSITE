import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { diskAreaCm2, parseDims, productFacts } from "../apps/website/src/frontend/lib/product-facts";
import { feedItem, googleCategory } from "../apps/website/src/frontend/lib/merchant-feed";
import { productFaqs } from "../apps/website/src/frontend/components/seo/schema";
import { latestImageSet } from "../apps/dashboard/src/lib/seed-ownership";
import { TOPIC_SEO, topicProducts } from "../apps/website/src/frontend/lib/topic-seo";
import { GUIDES } from "../apps/website/src/frontend/lib/guides";
import { CATEGORY_SEO } from "../apps/website/src/frontend/lib/category-seo";
import type { Product } from "../apps/website/src/frontend/lib/catalog";

const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");
const product = (p: Partial<Product>) =>
  ({ slug: "x", name: "X", categorySlug: "accessories", price: 1000, gstRate: 18, specs: [], moq: 1, unit: "pc", inStock: true, ...p }) as unknown as Product;
const specs = (o: Record<string, string>) => Object.entries(o).map(([label, value]) => ({ label, value }));

describe("arithmetic", () => {
  it("works out a disk's area", () => {
    expect(diskAreaCm2(3)).toBeCloseTo(0.0707, 4);
    expect(diskAreaCm2(2)).toBeCloseTo(0.0314, 4);
  });

  it.each([
    ["15x20 mm²", { a: 15, b: 20 }],
    ["10 × 10 cm", { a: 100, b: 100 }],
    ["W 200 mm x L 300 mm x T 1.5 mm", { a: 200, b: 300, t: 1.5 }],
    ["Platinum Sheet Counter Electrode 15 × 20 × 0.1mm", { a: 15, b: 20, t: 0.1 }],
    ["Copper Foam 200mm X 300mm", { a: 200, b: 300 }],
  ])("reads %s", (text, dims) => {
    expect(parseDims(text)).toEqual(dims);
  });

  it("finds no size where there is none", () => {
    expect(parseDims("Conductive carbon cloth")).toBeUndefined();
    expect(parseDims(undefined)).toBeUndefined();
  });
});

describe("what each family says", () => {
  it("gives a disk electrode's area and current density", () => {
    const f = productFacts(product({ name: "Gold Disk", categorySlug: "working-electrodes", specs: specs({ "Disk Diameter": "3 mm", "Body Material": "PTFE", "Body Diameter": "6mm", "Body Length": "80mm" }) }));
    expect(f.model[0]).toBe("The 3 mm disk has a geometric area of 0.0707 cm², so a current of 1 mA is a current density of 14.1 mA/cm².");
    expect(f.model[1]).toBe("It sits in a PTFE body, 6 mm by 80 mm.");
    expect(f.faqs[0].q).toContain("Gold Disk");
  });

  it("gives a sheet's area on each face", () => {
    const f = productFacts(product({ name: "Platinum Sheet Counter Electrode 15 × 20 × 0.1mm", categorySlug: "counter-electrodes", specs: specs({ size: "15x20 mm²" }) }));
    expect(f.model[0]).toBe("At 15 × 20 mm, it has 3 cm² per face, or 6 cm² counting both faces.");
    expect(f.model[1]).toContain("about 85 times");
  });

  it("does not read a wire's diameter and length as a sheet", () => {
    const f = productFacts(product({ name: "Platinum Wire Counter Electrode Ø0.5 × 37mm PEEK Rod", categorySlug: "counter-electrodes", specs: specs({ "Wire Diameter": "500 µm", "Wire Length": "37 mm", "Body Material": "PEEK" }) }));
    expect(f.model[0]).toBe("A 0.5 mm wire 37 mm long has about 0.581 cm² of surface when fully immersed.");
  });

  it("gives the RHE shift for a reference electrode", () => {
    const f = productFacts(product({ name: "Hg/HgO", categorySlug: "reference-electrodes", specs: specs({ "Filling Solution": "1M KOH", "Reference Potential": "+0.098 V vs. NHE at 25°C in 1M KOH", "Tube Diameter": "4 mm", "Effective Length": "60 mm" }) }));
    expect(f.model.join(" ")).toContain("To put a reading on the RHE scale at pH 14, add 0.927 V.");
    expect(f.model[0]).toBe("This model has a 4 mm body with an effective length of 60 mm.");
  });

  it("converts a pump's flow to litres per hour", () => {
    const f = productFacts(product({ name: "MPP70", categorySlug: "peristaltic-pumps", specs: specs({ "Flow Rate": "0 – 70 mL/min", "Operating Voltage": "DC 12 V" }) }));
    expect(f.model[0]).toBe("Flow rate is 0 – 70 mL/min, which is up to 4.2 litres per hour.");
  });

  it("gives a membrane's thickness in mil", () => {
    const f = productFacts(product({ name: "PiperION", categorySlug: "aem-membranes", specs: specs({ Thickness: "20 µm" }) }));
    expect(f.model[0]).toBe("It is 20 µm thick, about 0.787 mil.");
  });

  it("counts electrodes cut from a sheet", () => {
    const f = productFacts(product({ name: "Nickel Foam", categorySlug: "carbon-gdl", specs: specs({ Size: "W 200 mm x L 300 mm x T 1.5 mm" }) }));
    expect(f.model[0]).toBe("A 200 × 300 mm sheet gives up to 600 electrodes of 1 × 1 cm, or 24 of 5 × 5 cm.");
  });

  it("gives a press's force", () => {
    const f = productFacts(product({ name: "Press", categorySlug: "mea-fabrication", specs: specs({ "Press Capacity": "30 Tons" }) }));
    expect(f.model[0]).toBe("A 30 ton press applies up to about 294 kN of force.");
  });

  it("says nothing when the specs say nothing", () => {
    const f = productFacts(product({ name: "Plain", categorySlug: "counter-electrodes" }));
    expect(f.model).toEqual([]);
    expect(f.faqs).toEqual([]);
  });
});

describe("price lines", () => {
  const a = product({ slug: "a", name: "A", price: 1000 });
  const b = product({ slug: "b", name: "B", price: 2000 });
  const c = product({ slug: "c", name: "C", price: 3000 });

  it("states the price with GST", () => {
    expect(productFacts(a).buying[0]).toContain("plus 18% GST");
  });

  it("places a model among the others", () => {
    expect(productFacts(a, [b, c], "sheet").buying[1]).toBe("It is the lowest priced of the 3 sheet models we list.");
    expect(productFacts(c, [a, b], "sheet").buying[1]).toBe("It is the highest priced of the 3 sheet models we list.");
    const mid = productFacts(b, [a, c], "sheet").buying;
    expect(mid[1]).toBe("Of the 3 sheet models we list, 1 cost less and 1 cost more.");
    expect(mid[2]).toContain("the A,");
  });

  it("does not call a tie the lowest", () => {
    const line = productFacts(a, [product({ slug: "d", name: "D", price: 1000 })], "sheet").buying.join(" ");
    expect(line).not.toContain("lowest priced");
  });

  it("says nothing about price on a product with none", () => {
    expect(productFacts(product({ price: 0 }), [a], "sheet").buying).toEqual([]);
  });
});

describe("product page", () => {
  const page = src("app/shop/p/[slug]/page.tsx");
  it("shows the facts and leaves a large family's guide on its hub", () => {
    expect(page).toContain("productFacts(product, siblings, searchTerms[0])");
    expect(page).toContain("inCategory.length > 6");
    expect(page).toContain("...(guideOnHub ? [] : familySeo?.faqs ?? [])");
  });

  it("drops the policy FAQs only when asked", () => {
    const p = { name: "X", inStock: true } as never;
    const qs = (o?: { policies?: boolean }) => productFaqs(p, o).map((f) => f.q);
    expect(qs()).toContain("Do you provide a GST invoice?");
    expect(qs({ policies: false })).not.toContain("Do you provide a GST invoice?");
    expect(qs({ policies: false })).toContain("Is X in stock?");
  });
});

describe("Merchant feed", () => {
  const p = product({
    id: "abc",
    name: "Noble metal plate platinum 30 × 30 × 0.1mm",
    seoTitle: "Platinum Plate, 30 x 30 x 0.1 mm",
    categorySlug: "counter-electrodes",
    imageUrl: "/img.webp",
    specs: specs({ size: "30x30 mm²", thickness: "0.1 mm", "In the box": "1 × electrode" }),
  } as Partial<Product>);
  const xml = feedItem(p, "https://www.metnmat.com", "Counter Electrodes");

  it("leads with the search title", () => {
    expect(xml).toContain("<title>Platinum Plate, 30 x 30 x 0.1 mm</title>");
  });

  it("names Google's category", () => {
    expect(xml).toContain("<g:google_product_category>4255</g:google_product_category>");
    expect(googleCategory("h-cell")).toBe(4335);
    expect(googleCategory("consumables")).toBe(3002);
    expect(googleCategory("constructor")).toBe(4335);
  });

  it("sends highlights and specs, and keeps the box list out", () => {
    expect(xml).toContain("<g:product_highlight>");
    expect(xml).toContain("<g:attribute_name>thickness</g:attribute_name><g:attribute_value>0.1 mm</g:attribute_value>");
    expect(xml).not.toContain("<g:attribute_name>In the box");
  });
});

describe("photo set", () => {
  it("takes the newest complete upload, in order", () => {
    const n = "Peristaltic Pump Single Channel MPP70";
    const files = [`${n} 2-1.webp`, `${n} 2-2.webp`, `${n} 2-3.webp`, `${n} 1-3.webp`, `${n} 3-3.webp`, `${n} 1-1.webp`, "Other Pump 1-9.webp"];
    expect(latestImageSet(files, n)).toEqual([`${n} 1-3.webp`, `${n} 2-3.webp`, `${n} 3-3.webp`]);
  });

  it("finds nothing for a name with no files", () => {
    expect(latestImageSet(["Other 1-1.webp"], "Peristaltic Pump")).toEqual([]);
  });
});

describe("new pages", () => {
  const names = (...n: [string, string][]) => n.map(([name, categorySlug]) => product({ slug: name, name, categorySlug }));

  it("platinum topics split the catalogue without overlap", () => {
    const all = names(
      ["Platinum Wire Counter Electrode Ø0.5 × 37mm PEEK Rod", "counter-electrodes"],
      ["Platinum Wire Ring Counter Electrode Ø0.5 × 100mm", "counter-electrodes"],
      ["Platinum mesh electrode without diagonal reinforcement 20 × 20mm", "counter-electrodes"],
      ["Platinum Sheet Counter Electrode 15 × 20 × 0.1mm", "counter-electrodes"],
      ["Noble metal plate platinum 30 × 30 × 0.1mm", "counter-electrodes"],
    );
    expect(topicProducts(TOPIC_SEO["platinum-wire-electrodes"], all)).toHaveLength(1);
    expect(topicProducts(TOPIC_SEO["platinum-mesh-electrodes"], all)).toHaveLength(1);
    expect(topicProducts(TOPIC_SEO["platinum-sheet-electrodes"], all)).toHaveLength(2);
  });

  it("guides link only to pages that exist", () => {
    for (const g of Object.values(GUIDES)) {
      for (const { href } of g.links) {
        const [, kind, slug] = href.split("/").slice(1).length === 3 ? href.split("/").slice(1) : ["", "", ""];
        if (kind === "c") expect(CATEGORY_SEO[slug], href).toBeDefined();
        if (kind === "t") expect(TOPIC_SEO[slug], href).toBeDefined();
        if (href.startsWith("/guides/")) expect(GUIDES[href.slice(8)], href).toBeDefined();
      }
    }
  });

  it("never calls a METNMAT membrane Nafion", () => {
    expect(JSON.stringify(GUIDES)).not.toMatch(/nafion/i);
    expect(JSON.stringify(TOPIC_SEO)).not.toMatch(/nafion/i);
  });
});
