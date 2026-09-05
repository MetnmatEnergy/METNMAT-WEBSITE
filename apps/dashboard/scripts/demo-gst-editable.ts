/**
 * Demonstrate the loop the owner asked for: an employee edits the GST rate,
 * and the new rate lands on the website price.
 *
 * Runs against the DEV database on a live local stack (CMS :3001, website
 * :3000) and cleans up after itself. Dev only.
 */
import { assertTarget, loadEnv } from "./_bootstrap";

loadEnv();
const { target, dbName } = assertTarget(process.argv.slice(2));
if (target !== "dev") {
  console.error("demo-gst-editable writes test data — dev only.");
  process.exit(1);
}

const NET_PRICE = 1000;

async function pagePrice(slug: string): Promise<string> {
  const html = (await (await fetch(`http://localhost:3000/shop/p/${slug}`)).text()).replace(
    /<!-- -->/g,
    "",
  );
  const m = html.match(/₹([\d,]+)\s*<\/span>\s*<span[^>]*>\s*\/\s*[a-z]+/i) || html.match(/₹([\d,]+)/);
  return m ? `₹${m[1]}` : "(not found)";
}

async function main(): Promise<void> {
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  const payload = await getPayload({ config });

  console.log(`\n=== GST rate is editable, and it reaches the website — db: ${dbName} ===\n`);

  const cats = await payload.find({ collection: "categories", limit: 1, overrideAccess: true });
  const p = await payload.create({
    collection: "products",
    data: {
      name: "ZZ GST Demo Product",
      slug: "",
      category: String(cats.docs[0]?.id ?? ""),
      price: NET_PRICE,
      moq: 1,
      unit: "unit",
      productType: "in-stock",
      inStock: true,
      _status: "published",
    } as never,
    overrideAccess: true,
  });
  const slug = String((p as { slug?: string }).slug);

  try {
    console.log(`product "${slug}"  net price ₹${NET_PRICE}\n`);
    console.log("  rate   expected   website shows");
    console.log("  ────   ────────   ─────────────");

    let failures = 0;
    for (const rate of [18, 12, 5, 0, 28]) {
      // Exactly what a staff member does in the admin: change the field, save.
      await payload.update({
        collection: "products",
        id: p.id,
        data: { gstRate: rate } as never,
        overrideAccess: true,
      });

      // The website revalidates on save; give the tag purge a moment to land.
      await new Promise((r) => setTimeout(r, 1500));

      const expected = `₹${Math.round(NET_PRICE * (1 + rate / 100)).toLocaleString("en-IN")}`;
      const shown = await pagePrice(slug);
      const ok = shown === expected;
      if (!ok) failures++;
      console.log(
        `  ${String(rate).padStart(3)}%   ${expected.padStart(8)}   ${shown.padStart(8)}  ${ok ? "OK" : "MISMATCH"}`,
      );
    }

    // And the guard: a rate that is not a slab must be refused, not charged.
    let refused = false;
    try {
      await payload.update({
        collection: "products",
        id: p.id,
        data: { gstRate: 8 } as never,
        overrideAccess: true,
      });
    } catch (e) {
      refused = true;
      console.log(`\n  8% refused: ${String((e as Error).message).slice(0, 120)}`);
    }
    if (!refused) {
      console.log("\n  8% was ACCEPTED — the slab validator is not doing its job");
      failures++;
    }

    console.log(`\n${failures === 0 ? "Every rate landed on the website." : `${failures} mismatch(es).`}`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await payload.delete({ collection: "products", id: p.id, overrideAccess: true });
    console.log("demo product deleted");
  }
  process.exit(process.exitCode ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
