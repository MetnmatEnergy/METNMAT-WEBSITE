/**
 * The GST rates a product may actually be sold at.
 *
 * WHY THIS EXISTS. `Products.gstRate` was locked, and its description said why:
 * "checkout does not yet honour per-product rates, so this field is locked to
 * avoid promising what billing doesn't deliver." It is honoured now — the
 * storefront price, the cart, the amount sent to Razorpay and the rate frozen
 * onto each order line all read it. Unlocking it without this validator would
 * trade one problem for a worse one: a free number field accepts 8%, or 1.8,
 * or 180, none of which is a rate anyone can charge, and the mistake would bill
 * every customer of that product until a human noticed.
 *
 * IT IS ALSO A PRICE, which is the part that surprises people. Catalogue prices
 * are stored EXCLUDING tax and shown INCLUDING it, so ₹100 is ₹118 at 18% and
 * ₹105 at 5%. `lib/tax.ts:28-32` already warns that this is easy to do by
 * accident while intending only to correct a tax line. The field description
 * says so where staff will read it.
 */

/** The Indian GST slabs. 0 is exempt/nil-rated and is a real, chargeable rate. */
export const GST_SLABS = [0, 5, 12, 18, 28] as const;

export type GstSlab = (typeof GST_SLABS)[number];

export const isGstSlab = (rate: unknown): rate is GstSlab =>
  typeof rate === "number" && (GST_SLABS as readonly number[]).includes(rate);

/** "0%, 5%, 12%, 18% or 28%" — built from the list so it cannot fall out of step. */
export const slabList = (): string => {
  const labels = GST_SLABS.map((s) => `${s}%`);
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
};

/**
 * Refuse a rate that is not a real slab.
 *
 * Empty is allowed: the field carries `defaultValue: 18`, and refusing a blank
 * would block the save before the default is applied. An absent rate is read as
 * the site rate downstream (`gstRateFor`), never as exempt.
 */
export function gstSlabValidator(value: unknown): true | string {
  if (value === null || value === undefined || value === "") return true;

  const rate = Number(value);
  if (!Number.isFinite(rate)) return `Enter a GST rate: ${slabList()}.`;
  if (isGstSlab(rate)) return true;

  return (
    `${rate}% is not a GST slab. Use ${slabList()} — ` +
    `this rate is charged to the customer, so a value in between would bill an amount that cannot be invoiced.`
  );
}
