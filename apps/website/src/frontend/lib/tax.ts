/**
 * Tax treatment, separated from price.
 *
 * WHAT WAS WRONG
 * 18% was applied as a universal product tax. `inclGST()` adds it to every
 * price regardless of who is buying, and the invoice printed a flat "GST (18%)"
 * line for non-India buyers — the same rate an Indian customer pays, on a
 * transaction that is not the same kind of transaction. Nothing in the code
 * could express "this sale is taxed differently" because there was no place to
 * say it: the rate was a constant and the region never reached the tax
 * decision.
 *
 * WHAT THIS CHANGES
 * Only the architecture. `resolveTax()` takes the region and a policy and
 * returns the line to charge and print, so India and international treatment
 * are now configured separately rather than assumed identical.
 *
 * WHAT THIS DELIBERATELY DOES NOT CHANGE
 * The default policy reproduces production exactly — 18% for everyone. Exports
 * of goods are commonly zero-rated under an LUT, but "commonly" is not a basis
 * on which to alter what a customer is charged or what a tax invoice asserts.
 * Choosing ZERO_RATED_EXPORT is a decision for the company and its CA, and it
 * is two decisions, not one:
 *
 *   1. TAX: is the sale zero-rated? That depends on whether a valid LUT is in
 *      force, whether the goods are exported as goods, and how payment is
 *      received. A CA answers this.
 *   2. PRICE: catalogue prices are stored EXCLUDING tax and shown INCLUDING it.
 *      Removing 18% from an international sale therefore drops the price the
 *      customer pays by 18% unless the list price is raised to compensate. That
 *      is a commercial decision about margin, not a tax one, and it is easy to
 *      make by accident while intending only to fix the tax line.
 *
 * Until both are answered, the policy stays as it is and the behaviour is
 * unchanged.
 */
import type { Region } from "./region";

/** How a sale is taxed. Names describe the treatment, not the rate. */
export type TaxTreatment = "TAXABLE" | "ZERO_RATED_EXPORT";

export type TaxPolicy = {
  /** GST percentage applied to Indian sales. */
  indiaRatePercent: number;
  /** How sales outside India are treated. */
  internationalTreatment: TaxTreatment;
  /**
   * Rate for international sales when the treatment is TAXABLE. Normally the
   * same as India's — which is exactly what production does today — but held
   * separately so the two cannot drift into each other by accident.
   */
  internationalRatePercent: number;
};

/**
 * Production's current behaviour, and the fallback whenever configuration is
 * missing or unreadable. A tax policy that silently changes because a CMS field
 * failed to load would be worse than one that never changes at all.
 */
export const DEFAULT_TAX_POLICY: TaxPolicy = {
  indiaRatePercent: 18,
  internationalTreatment: "TAXABLE",
  internationalRatePercent: 18,
};

export type TaxLine = {
  treatment: TaxTreatment;
  /** 0 when zero-rated. */
  ratePercent: number;
  /** Tax contained within the inclusive total, in the same units. */
  amount: number;
  /** What the invoice prints. */
  label: string;
};

/**
 * A rate must arrive AS a number.
 *
 * Coercing would be actively dangerous here: Number(null) is 0, and 0 is a
 * VALID rate, so a cleared or absent CMS field would parse as "tax-free" and
 * every sale would quietly stop charging tax. Falling back to the configured
 * default is the only safe reading of a value that is not a number.
 *
 * 0–28 matches the GST slabs the Products collection already allows.
 */
const clampRate = (n: unknown, fallback: number): number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 28 ? n : fallback;

/** Read a policy out of CMS config, falling back field by field. */
export function taxPolicyFrom(config: unknown): TaxPolicy {
  const c = (config ?? {}) as Record<string, unknown>;
  const treatment =
    c.internationalTaxTreatment === "ZERO_RATED_EXPORT" ? "ZERO_RATED_EXPORT" : "TAXABLE";
  return {
    indiaRatePercent: clampRate(c.indiaGstRate, DEFAULT_TAX_POLICY.indiaRatePercent),
    internationalTreatment: treatment,
    internationalRatePercent: clampRate(
      c.internationalTaxRate,
      DEFAULT_TAX_POLICY.internationalRatePercent
    ),
  };
}

/** The rate that applies to a region, as a percentage. */
export function taxRateFor(region: Region, policy: TaxPolicy = DEFAULT_TAX_POLICY): number {
  if (region === "IN") return policy.indiaRatePercent;
  return policy.internationalTreatment === "ZERO_RATED_EXPORT" ? 0 : policy.internationalRatePercent;
}

/**
 * The tax contained inside an already-inclusive amount.
 *
 * Inclusive rather than additive because that is how this catalogue works: the
 * customer sees one number and the tax is the portion of it, so the total can
 * never disagree with its own tax line by a rounding step.
 */
export function resolveTax(
  region: Region,
  inclusiveAmount: number,
  policy: TaxPolicy = DEFAULT_TAX_POLICY
): TaxLine {
  const ratePercent = taxRateFor(region, policy);
  if (ratePercent <= 0) {
    return {
      treatment: "ZERO_RATED_EXPORT",
      ratePercent: 0,
      amount: 0,
      label: "Zero-rated export",
    };
  }
  const rate = ratePercent / 100;
  return {
    treatment: "TAXABLE",
    ratePercent,
    amount: Math.round(inclusiveAmount - inclusiveAmount / (1 + rate)),
    label: `GST (${ratePercent}%)`,
  };
}

/**
 * Split an Indian GST amount into CGST + SGST, or leave it as IGST.
 *
 * Intra-state sales are billed as two half-rate components; everything else in
 * India is one IGST line. This only restates what the invoice already did — it
 * is here so the rule lives with the rest of the tax logic instead of inside a
 * template string.
 */
export function splitIndianGst(
  amount: number,
  intraState: boolean
): { cgst: number; sgst: number; igst: number } {
  if (!intraState) return { cgst: 0, sgst: 0, igst: amount };
  const cgst = Math.round((amount / 2) * 100) / 100;
  return { cgst, sgst: Math.round((amount - cgst) * 100) / 100, igst: 0 };
}

// ── Rate-wise tax summary for the invoice ────────────────────────────────────

/** One rate present on an invoice, with the value taxed at it. */
export type InvoiceTaxGroup = { ratePercent: number; taxable: number; tax: number };

export type InvoiceTaxInput = {
  total?: number;
  gstAmount?: number;
  taxRatePercent?: number;
  items: ReadonlyArray<{ lineTotal?: number; taxRatePercent?: number; taxAmount?: number }>;
};

/**
 * The rate-wise tax summary a GST invoice has to state.
 *
 * WHY GROUPED. The invoice printed ONE tax row at the order's single rate,
 * which was true while GST was site-wide at 18%. Products now carry their own
 * rates, so a cart can mix a 5% consumable with an 18% instrument — and one
 * rate beside a total computed from two is a false statement on a statutory
 * document. A GST invoice states, per rate: the taxable value and the tax on
 * it. A single-rate order therefore produces exactly one group and reads
 * exactly as it always did.
 *
 * THE FALLBACK IS THE POINT, not defensive padding. An invoice is a statement
 * about a PAST transaction, and every order placed before per-line tax existed
 * carries no per-line data. Those fall back to the order-level rate and amount,
 * so a document already sent to a customer keeps rendering the figures they
 * hold. An order only part-way migrated — some lines snapshotted, some not —
 * also falls back, because half a tax summary is worse than the order-level one
 * it replaced.
 *
 * Taxable value is derived by subtraction (`lineTotal - taxAmount`) rather than
 * recomputed from the rate: the line total is what was actually charged, and
 * re-deriving it could drift by a rupee from the amount the customer paid.
 */
export function taxGroupsForInvoice(order: InvoiceTaxInput): InvoiceTaxGroup[] {
  const items = order.items ?? [];
  const orderRate =
    typeof order.taxRatePercent === "number" && order.taxRatePercent >= 0 ? order.taxRatePercent : 18;

  const orderLevel = (): InvoiceTaxGroup[] => {
    const tax = order.gstAmount ?? 0;
    const total = order.total ?? items.reduce((n, it) => n + (it.lineTotal ?? 0), 0);
    return [{ ratePercent: orderRate, taxable: Math.max(0, total - tax), tax }];
  };

  if (!items.length) return orderLevel();

  // EVERY line must carry the snapshot, or the per-line view is incomplete.
  const complete = items.every(
    (it) => typeof it.taxRatePercent === "number" && typeof it.taxAmount === "number",
  );
  if (!complete) return orderLevel();

  const byRate = new Map<number, InvoiceTaxGroup>();
  for (const it of items) {
    const rate = it.taxRatePercent as number;
    const tax = it.taxAmount as number;
    const line = it.lineTotal ?? 0;
    const g = byRate.get(rate) ?? { ratePercent: rate, taxable: 0, tax: 0 };
    g.taxable += line - tax;
    g.tax += tax;
    byRate.set(rate, g);
  }

  return [...byRate.values()].sort((a, b) => a.ratePercent - b.ratePercent);
}

/**
 * The tax rows of an invoice, one entry per rate present.
 *
 * Extracted from the invoice route so it can be TESTED rather than
 * source-asserted. Mutations that split the order total once instead of per
 * rate, or that render only the first group, are invisible to a test that only
 * exercises the grouping — and both would misstate a statutory document.
 *
 * Returns label/amount pairs rather than HTML: the caller owns the markup, and
 * a test should assert what the invoice SAYS, not how it is styled.
 */
export function invoiceTaxRows(
  groups: readonly InvoiceTaxGroup[],
  opts: { treatment: "TAXABLE" | "ZERO_RATED_EXPORT"; isIndia: boolean; intraState: boolean },
): Array<{ label: string; amount: number }> {
  if (opts.treatment === "ZERO_RATED_EXPORT") {
    return [{ label: "Zero-rated export (LUT)", amount: 0 }];
  }

  return groups.flatMap((g) => {
    if (!opts.isIndia) return [{ label: `GST (${g.ratePercent}%)`, amount: g.tax }];
    if (!opts.intraState) return [{ label: `IGST (${g.ratePercent}%)`, amount: g.tax }];

    // Each rate splits on its own. Halving the ORDER total once and labelling
    // it with a single rate is exactly what could not state a mixed supply.
    const half = Math.round((g.ratePercent / 2) * 100) / 100;
    const { cgst, sgst } = splitIndianGst(g.tax, true);
    return [
      { label: `CGST (${half}%)`, amount: cgst },
      { label: `SGST (${half}%)`, amount: sgst },
    ];
  });
}
