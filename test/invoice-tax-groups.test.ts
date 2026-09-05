import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  invoiceTaxRows,
  splitIndianGst,
  taxGroupsForInvoice,
  type InvoiceTaxInput,
} from "../apps/website/src/frontend/lib/tax";

/**
 * A tax invoice has to state the tax RATE-WISE, and orders can now mix rates.
 *
 * WHAT THE INVOICE DID. One tax row, at `order.taxRatePercent`, for
 * `order.gstAmount` — a single rate applied to the whole order. That was true
 * while GST was site-wide at 18%. It stopped being true the moment products
 * carried their own rates: a cart with a 5% consumable and an 18% instrument
 * would have printed ONE rate beside a total computed from two, which is a
 * false statement on a statutory document.
 *
 * WHAT A GST INVOICE ACTUALLY NEEDS. For each rate present: the taxable value
 * at that rate, and the tax on it — split CGST+SGST for an intra-state supply
 * or shown as IGST for inter-state. So the summary is grouped by rate, not by
 * line, and a single-rate order naturally produces exactly one group.
 *
 * THE CONSTRAINT THAT SHAPES ALL OF THIS. An invoice is a statement about a
 * PAST transaction. The route already says so: "if changing the tax policy
 * tomorrow re-rendered yesterday's invoice, every document already sent to a
 * customer would quietly stop matching the one they hold." Every order placed
 * before per-line tax existed carries no per-line data at all, and those must
 * render EXACTLY as they did — same rows, same figures. That is the first
 * block below, and it is the one that matters most.
 */

const order = (over: Partial<InvoiceTaxInput> = {}): InvoiceTaxInput => ({
  total: 1180,
  gstAmount: 180,
  taxRatePercent: 18,
  items: [],
  ...over,
});

describe("an order from before per-line tax renders exactly as it always did", () => {
  it("one group, at the order's own rate, for the order's own tax", () => {
    // The legacy shape: items carry no taxRatePercent and no taxAmount.
    const g = taxGroupsForInvoice(
      order({ items: [{ lineTotal: 1180 }, { lineTotal: 0 }] }),
    );
    expect(g).toEqual([{ ratePercent: 18, taxable: 1000, tax: 180 }]);
  });

  it("uses 18% when the order recorded no rate either", () => {
    // Orders that predate the tax-treatment fields were all taxed at 18%, so
    // that is the historical fact rather than a default.
    const g = taxGroupsForInvoice(order({ taxRatePercent: undefined, items: [{ lineTotal: 1180 }] }));
    expect(g).toEqual([{ ratePercent: 18, taxable: 1000, tax: 180 }]);
  });

  it("an order with no items at all still states its tax", () => {
    expect(taxGroupsForInvoice(order({ items: [] }))).toEqual([
      { ratePercent: 18, taxable: 1000, tax: 180 },
    ]);
  });

  it("a zero-rated export has nothing to group", () => {
    const g = taxGroupsForInvoice(order({ gstAmount: 0, total: 1000, taxRatePercent: 0, items: [] }));
    expect(g).toEqual([{ ratePercent: 0, taxable: 1000, tax: 0 }]);
  });
});

describe("an order with per-line rates is grouped by rate", () => {
  it("one rate produces one group, identical to the legacy shape", () => {
    // The bridge case: new data, single rate. Must look like it always did.
    const g = taxGroupsForInvoice(
      order({
        total: 2360,
        gstAmount: 360,
        items: [
          { lineTotal: 1180, taxRatePercent: 18, taxAmount: 180 },
          { lineTotal: 1180, taxRatePercent: 18, taxAmount: 180 },
        ],
      }),
    );
    expect(g).toEqual([{ ratePercent: 18, taxable: 2000, tax: 360 }]);
  });

  it("two rates produce two groups, each with its own taxable value", () => {
    // The case the old invoice could not state.
    const g = taxGroupsForInvoice(
      order({
        total: 2230,
        gstAmount: 230,
        items: [
          { lineTotal: 1180, taxRatePercent: 18, taxAmount: 180 },
          { lineTotal: 1050, taxRatePercent: 5, taxAmount: 50 },
        ],
      }),
    );
    expect(g).toEqual([
      { ratePercent: 5, taxable: 1000, tax: 50 },
      { ratePercent: 18, taxable: 1000, tax: 180 },
    ]);
  });

  it("groups ascend by rate, so the summary reads predictably", () => {
    const g = taxGroupsForInvoice(
      order({
        items: [
          { lineTotal: 1280, taxRatePercent: 28, taxAmount: 280 },
          { lineTotal: 1000, taxRatePercent: 0, taxAmount: 0 },
          { lineTotal: 1120, taxRatePercent: 12, taxAmount: 120 },
        ],
      }),
    );
    expect(g.map((x) => x.ratePercent)).toEqual([0, 12, 28]);
  });

  it("sums several lines sharing a rate into one group", () => {
    const g = taxGroupsForInvoice(
      order({
        items: [
          { lineTotal: 1180, taxRatePercent: 18, taxAmount: 180 },
          { lineTotal: 2360, taxRatePercent: 18, taxAmount: 360 },
          { lineTotal: 1050, taxRatePercent: 5, taxAmount: 50 },
        ],
      }),
    );
    expect(g).toEqual([
      { ratePercent: 5, taxable: 1000, tax: 50 },
      { ratePercent: 18, taxable: 3000, tax: 540 },
    ]);
  });

  it("an exempt line is a real group, not an omission", () => {
    // 0% must appear on the invoice: a nil-rated supply is still a supply and
    // its taxable value belongs on the document.
    const g = taxGroupsForInvoice(
      order({
        items: [
          { lineTotal: 1000, taxRatePercent: 0, taxAmount: 0 },
          { lineTotal: 1180, taxRatePercent: 18, taxAmount: 180 },
        ],
      }),
    );
    expect(g).toContainEqual({ ratePercent: 0, taxable: 1000, tax: 0 });
  });

  it("the groups account for the whole order", () => {
    const o = order({
      items: [
        { lineTotal: 1180, taxRatePercent: 18, taxAmount: 180 },
        { lineTotal: 1050, taxRatePercent: 5, taxAmount: 50 },
        { lineTotal: 1000, taxRatePercent: 0, taxAmount: 0 },
      ],
    });
    const g = taxGroupsForInvoice(o);
    const sumTax = g.reduce((n, x) => n + x.tax, 0);
    const sumTaxable = g.reduce((n, x) => n + x.taxable, 0);
    const itemsTotal = o.items.reduce((n, it) => n + (it.lineTotal ?? 0), 0);
    expect(sumTax).toBe(230);
    expect(sumTaxable + sumTax).toBe(itemsTotal);
  });

  it("a partially-migrated order falls back rather than inventing a rate", () => {
    // If any line lacks the snapshot the per-line view is incomplete, and half
    // a tax summary is worse than the order-level one it replaced.
    const g = taxGroupsForInvoice(
      order({
        total: 2230,
        gstAmount: 230,
        items: [
          { lineTotal: 1180, taxRatePercent: 18, taxAmount: 180 },
          { lineTotal: 1050 },
        ],
      }),
    );
    expect(g).toEqual([{ ratePercent: 18, taxable: 2000, tax: 230 }]);
  });
});

describe("the CGST/SGST split still applies per rate", () => {
  it("halves each group's tax intra-state", () => {
    // Splitting the ORDER total once and labelling it with one rate is what
    // this replaces; each rate now splits on its own.
    const a = splitIndianGst(180, true);
    const b = splitIndianGst(50, true);
    expect(a.cgst + a.sgst).toBe(180);
    expect(b.cgst + b.sgst).toBe(50);
    expect(a.cgst).toBe(90);
    expect(b.cgst).toBe(25);
  });

  it("an odd amount keeps the halves summing to the whole", () => {
    // A rupee must not be lost or invented between CGST and SGST.
    for (const amt of [1, 3, 7, 181, 12345]) {
      const { cgst, sgst } = splitIndianGst(amt, true);
      expect(cgst + sgst, `₹${amt}`).toBe(amt);
    }
  });

  it("inter-state puts the whole amount in IGST", () => {
    const { cgst, sgst, igst } = splitIndianGst(180, false);
    expect(igst).toBe(180);
    expect(cgst + sgst).toBe(0);
  });
});

describe("the invoice renders the summary it is given", () => {
  const src = readFileSync(
    join(__dirname, "..", "apps/website/src/app/api/orders/[orderNumber]/invoice/route.ts"),
    "utf8",
  );

  it("builds its tax rows from the grouped summary", () => {
    expect(src).toMatch(/taxGroupsForInvoice\(/);
  });

  it("still reads the ORDER, never current settings", () => {
    // The property the whole file is built around.
    expect(src).toMatch(/Tax lines come from what the ORDER recorded/);
  });

  it("delegates the tax decision rather than making a second one", () => {
    // CGST/SGST/IGST and the zero-rated line now live in lib/tax, where they
    // are asserted by behaviour rather than by grepping this file. A second
    // decision here is exactly the drift that would misstate the document.
    expect(src).toMatch(/invoiceTaxRows\(/);
    expect(src, "no rate arithmetic in the renderer").not.toMatch(/splitIndianGst\(/);
  });
});

describe("what the invoice actually prints", () => {
  const g = (ratePercent: number, taxable: number, tax: number) => ({ ratePercent, taxable, tax });
  const opts = (o: Partial<Parameters<typeof invoiceTaxRows>[1]> = {}) => ({
    treatment: "TAXABLE" as const,
    isIndia: true,
    intraState: true,
    ...o,
  });

  it("prints a CGST and an SGST row for EVERY rate, not just the first", () => {
    // A mutation rendering only the first group leaves the second rate's tax
    // collected but unstated — the invoice would not add up.
    const rows = invoiceTaxRows([g(5, 1000, 50), g(18, 1000, 180)], opts());
    expect(rows.map((r) => r.label)).toEqual([
      "CGST (2.5%)",
      "SGST (2.5%)",
      "CGST (9%)",
      "SGST (9%)",
    ]);
  });

  it("splits each rate's OWN tax, never the order total", () => {
    // The 5% group must show ₹25/₹25, not half of the combined ₹230.
    const rows = invoiceTaxRows([g(5, 1000, 50), g(18, 1000, 180)], opts());
    expect(rows.map((r) => r.amount)).toEqual([25, 25, 90, 90]);
  });

  it("the printed tax adds up to the tax collected", () => {
    const groups = [g(0, 1000, 0), g(12, 1000, 120), g(28, 1000, 280)];
    const printed = invoiceTaxRows(groups, opts()).reduce((n, r) => n + r.amount, 0);
    expect(printed).toBe(groups.reduce((n, x) => n + x.tax, 0));
  });

  it("inter-state prints one IGST row per rate", () => {
    const rows = invoiceTaxRows([g(5, 1000, 50), g(18, 1000, 180)], opts({ intraState: false }));
    expect(rows).toEqual([
      { label: "IGST (5%)", amount: 50 },
      { label: "IGST (18%)", amount: 180 },
    ]);
  });

  it("outside India prints plain GST per rate", () => {
    const rows = invoiceTaxRows([g(18, 1000, 180)], opts({ isIndia: false, intraState: false }));
    expect(rows).toEqual([{ label: "GST (18%)", amount: 180 }]);
  });

  it("a zero-rated export prints one line and no rates", () => {
    const rows = invoiceTaxRows([g(18, 1000, 180)], opts({ treatment: "ZERO_RATED_EXPORT" }));
    expect(rows).toEqual([{ label: "Zero-rated export (LUT)", amount: 0 }]);
  });

  it("a single-rate order prints exactly what it always did", () => {
    // The regression that matters most: existing invoices must not change.
    expect(invoiceTaxRows([g(18, 1000, 180)], opts())).toEqual([
      { label: "CGST (9%)", amount: 90 },
      { label: "SGST (9%)", amount: 90 },
    ]);
  });

  it("the route renders whatever this returns, and nothing else", () => {
    const src = readFileSync(
      join(__dirname, "..", "apps/website/src/app/api/orders/[orderNumber]/invoice/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/invoiceTaxRows\(groups, \{ treatment, isIndia, intraState \}\)/);
    expect(src, "no second CGST/SGST decision in the route").not.toMatch(/splitIndianGst\(/);
  });
});

describe("the charged amount is authoritative, not a recomputation", () => {
  it("taxable comes from lineTotal minus the tax that was charged", () => {
    // If the snapshot and the rate arithmetic disagree — rounding, or a rate
    // edited after the fact — the invoice must state what was BILLED. Deriving
    // taxable from the rate would print a figure the customer never paid.
    const groups = taxGroupsForInvoice({
      total: 1180,
      gstAmount: 181,
      taxRatePercent: 18,
      items: [{ lineTotal: 1180, taxRatePercent: 18, taxAmount: 181 }],
    });
    expect(groups).toEqual([{ ratePercent: 18, taxable: 999, tax: 181 }]);
  });
});
