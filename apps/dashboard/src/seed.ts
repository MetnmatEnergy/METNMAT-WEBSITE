import type { Payload } from "payload";

// Starter catalog (METNMAT's own domain — lab equipment, crucibles, analysis
// instruments, consumables, and METNMAT-made materials). Seeded on boot so the
// dashboard + shop have realistic data. Admins manage everything from /admin.
// Idempotent: only creates what's missing. No images here (upload via Media Library).

const categories = [
  { slug: "furnaces", name: "Furnaces", blurb: "Muffle, tubular & box furnaces" },
  { slug: "muffle-furnaces", name: "Muffle Furnaces", parentSlug: "furnaces" },
  { slug: "tubular-furnaces", name: "Tubular Furnaces", parentSlug: "furnaces" },
  { slug: "crucibles", name: "Crucibles", blurb: "Alumina, graphite, zirconia, platinum" },
  { slug: "analysis", name: "Analysis Instruments", blurb: "Microscopes, testers, spectrometers" },
  { slug: "consumables", name: "Consumables", blurb: "Mounting, polishing, etchants" },
  { slug: "raw-materials", name: "Raw Materials & Alloys", blurb: "Metals, powders & METNMAT alloys" },
  { slug: "safety", name: "Lab Safety", blurb: "PPE, storage & handling" },
];

type SeedProduct = {
  slug: string; name: string; brand: string; categorySlug: string; sku: string;
  price: number; mrp?: number; rating: number; moq: number; unit: string;
  inStock: boolean; featured: boolean; badges?: string[];
  priceTiers?: { minQty: number; price: number }[];
  specs: { label: string; value: string }[]; shortDesc: string;
};

const products: SeedProduct[] = [
  // Furnaces
  { slug: "muffle-furnace-1200", name: "Muffle Furnace 1200°C", brand: "MetLab", categorySlug: "muffle-furnaces", sku: "MF-1200", price: 84000, mrp: 96000, rating: 4.6, moq: 1, unit: "unit", inStock: true, featured: true, badges: ["Bestseller", "GST invoice"], priceTiers: [{ minQty: 2, price: 81000 }, { minQty: 5, price: 78000 }], specs: [{ label: "Max temperature", value: "1200°C" }, { label: "Chamber volume", value: "7 L" }, { label: "Control", value: "PID, programmable" }], shortDesc: "Programmable muffle furnace with PID control for ashing & heat treatment." },
  { slug: "muffle-furnace-1000", name: "Compact Muffle Furnace 1000°C", brand: "MetLab", categorySlug: "muffle-furnaces", sku: "MF-1000", price: 56000, rating: 4.3, moq: 1, unit: "unit", inStock: true, featured: false, specs: [{ label: "Max temperature", value: "1000°C" }, { label: "Chamber volume", value: "3 L" }], shortDesc: "Benchtop muffle furnace for small-batch ashing." },
  { slug: "tubular-furnace-1400", name: "Tubular Furnace 1400°C", brand: "MetLab", categorySlug: "tubular-furnaces", sku: "TF-1400", price: 132000, rating: 4.7, moq: 1, unit: "unit", inStock: true, featured: true, badges: ["New"], specs: [{ label: "Max temperature", value: "1400°C" }, { label: "Tube OD", value: "50 mm" }, { label: "Heating zones", value: "1" }], shortDesc: "Split-tube high-temperature furnace for controlled-atmosphere work." },
  { slug: "box-furnace-1600", name: "High-Temp Box Furnace 1600°C", brand: "MetLab", categorySlug: "furnaces", sku: "BF-1600", price: 268000, rating: 4.8, moq: 1, unit: "unit", inStock: true, featured: true, badges: ["GST invoice"], specs: [{ label: "Max temperature", value: "1600°C" }, { label: "Elements", value: "SiC" }, { label: "Chamber", value: "12 L" }], shortDesc: "SiC-element box furnace for sintering & advanced ceramics." },

  // Crucibles
  { slug: "zirconia-crucible", name: "Zirconia Crucible 50ml", brand: "CeraTech", categorySlug: "crucibles", sku: "CR-ZR-50", price: 1800, rating: 4.4, moq: 10, unit: "pc", inStock: true, featured: true, priceTiers: [{ minQty: 25, price: 1650 }, { minQty: 100, price: 1450 }], specs: [{ label: "Capacity", value: "50 ml" }, { label: "Material", value: "Zirconia" }, { label: "Max temp", value: "2200°C" }], shortDesc: "Thermal-shock resistant zirconia crucible." },
  { slug: "graphite-crucible", name: "Graphite Crucible 30ml", brand: "CeraTech", categorySlug: "crucibles", sku: "CR-GR-30", price: 1200, rating: 4.2, moq: 10, unit: "pc", inStock: true, featured: false, specs: [{ label: "Capacity", value: "30 ml" }, { label: "Material", value: "High-purity graphite" }], shortDesc: "High-purity graphite crucible for metal melting." },
  { slug: "alumina-crucible", name: "Alumina Crucible 50ml", brand: "CeraTech", categorySlug: "crucibles", sku: "CR-AL-50", price: 950, rating: 4.5, moq: 10, unit: "pc", inStock: true, featured: false, priceTiers: [{ minQty: 50, price: 850 }], specs: [{ label: "Capacity", value: "50 ml" }, { label: "Purity", value: "99.7% Al₂O₃" }], shortDesc: "High-purity alumina crucible for high-temperature use." },
  { slug: "platinum-crucible", name: "Platinum Crucible 30ml", brand: "CeraTech", categorySlug: "crucibles", sku: "CR-PT-30", price: 0, rating: 4.9, moq: 1, unit: "pc", inStock: false, featured: false, badges: ["GST invoice"], specs: [{ label: "Capacity", value: "30 ml" }, { label: "Purity", value: "99.95% Pt" }], shortDesc: "Platinum crucible for fusion & gravimetric analysis. Price on request." },

  // Analysis
  { slug: "metallurgical-microscope", name: "Metallurgical Microscope", brand: "OptiScope", categorySlug: "analysis", sku: "MS-1000", price: 245000, mrp: 268000, rating: 4.8, moq: 1, unit: "unit", inStock: true, featured: true, badges: ["GST invoice"], specs: [{ label: "Magnification", value: "50–1000×" }, { label: "Illumination", value: "LED" }, { label: "Camera", value: "5 MP" }], shortDesc: "Inverted metallurgical microscope with digital imaging." },
  { slug: "hardness-tester", name: "Vickers Hardness Tester", brand: "OptiScope", categorySlug: "analysis", sku: "HT-VK", price: 410000, rating: 4.5, moq: 1, unit: "unit", inStock: true, featured: false, specs: [{ label: "Method", value: "Vickers (HV)" }, { label: "Load range", value: "1–50 kgf" }], shortDesc: "Digital Vickers hardness tester with auto-turret." },
  { slug: "oes-spectrometer", name: "Optical Emission Spectrometer", brand: "OptiScope", categorySlug: "analysis", sku: "OES-PRO", price: 0, rating: 4.9, moq: 1, unit: "unit", inStock: false, featured: false, badges: ["GST invoice"], specs: [{ label: "Type", value: "Spark OES" }, { label: "Elements", value: "Fe, Al, Cu bases" }], shortDesc: "Spark OES for elemental analysis of metals & alloys. Price on request." },

  // Consumables
  { slug: "polishing-cloth-pack", name: "Polishing Cloth (Pack of 50)", brand: "PrepPro", categorySlug: "consumables", sku: "PC-50", price: 950, rating: 4.1, moq: 5, unit: "pack", inStock: true, featured: false, specs: [{ label: "Pack size", value: "50" }, { label: "Type", value: "Napless" }], shortDesc: "Metallographic polishing cloths." },
  { slug: "mounting-resin-kit", name: "Hot Mounting Resin Kit", brand: "PrepPro", categorySlug: "consumables", sku: "MR-KIT", price: 3200, rating: 4.0, moq: 1, unit: "kit", inStock: true, featured: false, specs: [{ label: "Contents", value: "1 kg resin + dye" }], shortDesc: "Phenolic hot-mounting resin for sample preparation." },
  { slug: "etchant-set", name: "Metallographic Etchant Set", brand: "PrepPro", categorySlug: "consumables", sku: "ET-SET", price: 4500, rating: 4.3, moq: 1, unit: "set", inStock: true, featured: false, specs: [{ label: "Bottles", value: "6 × 100 ml" }], shortDesc: "Common etchants for steels, Al & Cu alloys." },

  // Raw materials & METNMAT-made
  { slug: "copper-alloy-ingot", name: "High-Conductivity Copper Alloy", brand: "METNMAT", categorySlug: "raw-materials", sku: "CU-HC-91", price: 0, rating: 4.9, moq: 50, unit: "kg", inStock: false, featured: true, badges: ["Made by METNMAT"], specs: [{ label: "Conductivity", value: "91–93% IACS" }, { label: "Form", value: "Ingot" }], shortDesc: "High-conductivity copper alloy developed by METNMAT R&D." },
  { slug: "aluminium-foam-panel", name: "Aluminium Foam Panel", brand: "METNMAT", categorySlug: "raw-materials", sku: "AL-FOAM", price: 0, rating: 4.8, moq: 5, unit: "panel", inStock: false, featured: true, badges: ["Made by METNMAT"], specs: [{ label: "Density", value: "0.3–0.5 g/cm³" }, { label: "Use", value: "Lightweight / energy absorption" }], shortDesc: "Closed-cell aluminium foam panels. Price on request." },
  { slug: "ferritic-ss-sheet", name: "Ferritic Stainless Steel Sheet", brand: "METNMAT", categorySlug: "raw-materials", sku: "FSS-TX", price: 0, rating: 4.7, moq: 25, unit: "kg", inStock: false, featured: false, badges: ["Made by METNMAT"], specs: [{ label: "Grade", value: "Texture-controlled ferritic SS" }], shortDesc: "Texture-engineered ferritic stainless steel from METNMAT R&D." },

  // Safety
  { slug: "lab-ppe-kit", name: "Lab PPE Kit", brand: "SafeLab", categorySlug: "safety", sku: "PPE-KIT", price: 2200, rating: 4.2, moq: 5, unit: "kit", inStock: true, featured: false, specs: [{ label: "Includes", value: "Heat gloves, apron, face shield" }], shortDesc: "Personal protective equipment kit for foundry & lab use." },
];

async function cleanupMalformed(payload: Payload): Promise<void> {
  try {
    const res = await payload.delete({
      collection: "products",
      where: { or: [{ slug: { equals: "" } }, { slug: { exists: false } }] },
    });
    const removed = (res as { docs?: unknown[] })?.docs?.length ?? 0;
    if (removed) payload.logger.info(`[seed] Removed ${removed} malformed product(s).`);
  } catch {
    /* ignore */
  }
}

async function ensureCategory(
  payload: Payload,
  c: { slug: string; name: string; blurb?: string; parentSlug?: string },
  ids: Record<string, string | number>
): Promise<void> {
  const found = await payload.find({ collection: "categories", where: { slug: { equals: c.slug } }, limit: 1 });
  if (found.docs[0]) {
    ids[c.slug] = found.docs[0].id;
    return;
  }
  const doc = await payload.create({
    collection: "categories",
    data: { name: c.name, slug: c.slug, blurb: c.blurb, parent: c.parentSlug ? ids[c.parentSlug] : undefined },
  });
  ids[c.slug] = doc.id;
}

export async function seed(payload: Payload): Promise<void> {
  await cleanupMalformed(payload);

  const ids: Record<string, string | number> = {};
  for (const c of categories.filter((c) => !("parentSlug" in c))) await ensureCategory(payload, c, ids);
  for (const c of categories.filter((c) => "parentSlug" in c)) await ensureCategory(payload, c, ids);

  let created = 0;
  for (const p of products) {
    const found = await payload.find({ collection: "products", where: { slug: { equals: p.slug } }, limit: 1 });
    if (found.docs[0]) continue;
    await payload.create({
      collection: "products",
      data: {
        name: p.name, slug: p.slug, brand: p.brand, sku: p.sku, category: ids[p.categorySlug],
        price: p.price, mrp: p.mrp, unit: p.unit, moq: p.moq, rating: p.rating,
        inStock: p.inStock, featured: p.featured, badges: p.badges ?? [], priceTiers: p.priceTiers ?? [],
        specs: p.specs, shortDesc: p.shortDesc, _status: "published",
      },
    });
    created++;
  }
  if (created) payload.logger.info(`[seed] Created ${created} product(s).`);

  // Website settings (always kept up to date)
  await payload.updateGlobal({ slug: "company", data: { name: "METNMAT", legalName: "METNMAT Research & Innovations", tagline: "India's first private Metallurgy & Materials R&D", description: "METNMAT turns materials science into industrial advantage — from lab-scale prototype to full industrial scale. Turnkey R&D that makes processes cheaper, cleaner and stronger.", foundedYear: 2012 } });
  await payload.updateGlobal({ slug: "contact", data: { email: "contact@metnmat.com", phone: "+91 78726 86501", whatsapp: "+91 78726 86501", shippingNote: "Shipping across India & worldwide · ISO-aligned R&D", addresses: [{ label: "West Bengal", line: "Howrah, West Bengal, India" }, { label: "Odisha", line: "Sambalpur, Odisha, India" }] } });
  await payload.updateGlobal({ slug: "social", data: { linkedin: "#", youtube: "#", facebook: "#" } });
  await payload.updateGlobal({ slug: "seo", data: { defaultTitle: "METNMAT Research & Innovations", titleTemplate: "%s · METNMAT", description: "Metallurgy & materials R&D — lab equipment, crucibles, analysis instruments & METNMAT-engineered materials." } });

  payload.logger.info("[seed] Done.");
}
