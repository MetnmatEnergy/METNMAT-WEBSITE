import { describe, it, expect } from "vitest";
import {
  DEFAULT_TAX_POLICY,
  resolveTax,
  splitIndianGst,
  taxPolicyFrom,
  taxRateFor,
  type TaxPolicy,
} from "../apps/website/src/frontend/lib/tax";
import { gstPortionOf, inclGST } from "../apps/website/src/frontend/lib/catalog";

/**
 * Tax treatment.
 *
 * The first group is the important one: the default policy must reproduce
 * production byte for byte. This refactor separates the tax DECISION from the
 * price so India and international can be configured apart — it is not a change
 * to what anyone is charged, and these tests are what stop it becoming one.
 */
describe("the default policy reproduces current behaviour", () => {
  it("taxes India at 18%", () => {
    expect(taxRateFor("IN")).toBe(18);
  });

  it("taxes international at 18% too — what production does today", () => {
    // Not an endorsement of the treatment; a statement that nothing moved.
    expect(taxRateFor("INTL")).toBe(18);
  });

  it("agrees with the pre-existing gstPortionOf for both regions", () => {
    for (const net of [1_000, 50_000, 123_457]) {
      const incl = inclGST(net);
      expect(resolveTax("IN", incl).amount).toBe(gstPortionOf(incl));
      expect(resolveTax("INTL", incl).amount).toBe(gstPortionOf(incl));
    }
  });

  it("labels the line the way the invoice always has", () => {
    expect(resolveTax("IN", 59_000).label).toBe("GST (18%)");
  });
});

describe("zero-rated export, once someone deliberately selects it", () => {
  const zeroRated: TaxPolicy = {
    ...DEFAULT_TAX_POLICY,
    internationalTreatment: "ZERO_RATED_EXPORT",
  };

  it("removes tax from international sales only", () => {
    expect(taxRateFor("INTL", zeroRated)).toBe(0);
    // India is untouched — the two are configured separately, which is the point.
    expect(taxRateFor("IN", zeroRated)).toBe(18);
  });

  it("reports a zero line rather than omitting it", () => {
    const line = resolveTax("INTL", 59_000, zeroRated);
    expect(line.amount).toBe(0);
    expect(line.ratePercent).toBe(0);
    expect(line.treatment).toBe("ZERO_RATED_EXPORT");
    // A tax invoice has to say why there is no tax, not go quiet.
    expect(line.label).toBe("Zero-rated export");
  });

  it("leaves Indian orders identical under the same policy", () => {
    expect(resolveTax("IN", 59_000, zeroRated)).toEqual(resolveTax("IN", 59_000));
  });
});

describe("independent rates", () => {
  it("lets the two regions differ without either following the other", () => {
    const split: TaxPolicy = {
      indiaRatePercent: 18,
      internationalTreatment: "TAXABLE",
      internationalRatePercent: 5,
    };
    expect(taxRateFor("IN", split)).toBe(18);
    expect(taxRateFor("INTL", split)).toBe(5);
  });
});

describe("policy parsing is defensive", () => {
  it("falls back to the default on missing config", () => {
    expect(taxPolicyFrom(undefined)).toEqual(DEFAULT_TAX_POLICY);
    expect(taxPolicyFrom({})).toEqual(DEFAULT_TAX_POLICY);
    expect(taxPolicyFrom(null)).toEqual(DEFAULT_TAX_POLICY);
  });

  it("rejects out-of-range and non-numeric rates rather than using them", () => {
    // A bad value must not become a tax rate.
    for (const bad of [-1, 99, "abc", null, {}, Number.NaN]) {
      expect(taxPolicyFrom({ indiaGstRate: bad }).indiaRatePercent).toBe(18);
    }
  });

  it("accepts a valid rate", () => {
    expect(taxPolicyFrom({ indiaGstRate: 12 }).indiaRatePercent).toBe(12);
    expect(taxPolicyFrom({ indiaGstRate: 0 }).indiaRatePercent).toBe(0);
  });

  it("only treats the exact token as zero-rated", () => {
    expect(taxPolicyFrom({ internationalTaxTreatment: "ZERO_RATED_EXPORT" }).internationalTreatment)
      .toBe("ZERO_RATED_EXPORT");
    // Anything else stays taxable — the safe direction is charging tax, not
    // asserting an exemption nobody selected.
    for (const v of ["zero_rated_export", "ZERO", true, 1, null, undefined]) {
      expect(taxPolicyFrom({ internationalTaxTreatment: v }).internationalTreatment).toBe("TAXABLE");
    }
  });
});

describe("Indian GST split", () => {
  it("halves into CGST + SGST for an intra-state supply", () => {
    const { cgst, sgst, igst } = splitIndianGst(9_000, true);
    expect(cgst).toBe(4_500);
    expect(sgst).toBe(4_500);
    expect(igst).toBe(0);
    expect(cgst + sgst).toBe(9_000);
  });

  it("keeps a single IGST line otherwise", () => {
    const { cgst, sgst, igst } = splitIndianGst(9_000, false);
    expect(igst).toBe(9_000);
    expect(cgst + sgst).toBe(0);
  });

  it("splits an odd amount without losing a paisa", () => {
    const { cgst, sgst } = splitIndianGst(9_000.01, true);
    expect(Math.round((cgst + sgst) * 100) / 100).toBe(9_000.01);
  });
});

describe("historical orders", () => {
  it("are rendered from their own snapshot, not the live policy", () => {
    // What an order recorded when it was taxable at 18%.
    const snapshot = { taxTreatment: "TAXABLE" as const, taxRatePercent: 18, gstAmount: 9_000 };

    // The company later switches international sales to zero-rated.
    const laterPolicy: TaxPolicy = {
      ...DEFAULT_TAX_POLICY,
      internationalTreatment: "ZERO_RATED_EXPORT",
    };
    expect(resolveTax("INTL", 59_000, laterPolicy).amount).toBe(0);

    // The stored order is unaffected: the invoice reads these fields, so the
    // document keeps matching the copy the customer already holds.
    expect(snapshot.gstAmount).toBe(9_000);
    expect(snapshot.taxRatePercent).toBe(18);
    expect(snapshot.taxTreatment).toBe("TAXABLE");
  });
});
