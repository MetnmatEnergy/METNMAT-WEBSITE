/**
 * Bulk price tiers, validated as a set.
 *
 * WHAT WAS WRONG. `priceTiers` was a bare array of two numbers with no `min`,
 * no `max` and no validate. Three things could be saved and were then charged:
 *
 *   - a NEGATIVE tier price. It reached lineTotal in create-order/route.ts. A
 *     single-line cart made Razorpay reject the negative amount, so checkout
 *     failed with a generic message; a MIXED cart kept the total positive and
 *     simply charged less, producing a genuine paid order at an arbitrary
 *     discount.
 *   - a ZERO tier price. `required: true` does not exclude it — payload's number
 *     validator tests `!value && !isNumber(value)`, and isNumber(0) is true — so
 *     the row saved, was skipped at checkout, and rendered as "On request" in
 *     the tier table while the base price was charged.
 *   - a tier ABOVE the base price, so buying more cost more per unit.
 *
 * WHY THE WHOLE ARRAY. The rules that matter are about the rows together: two
 * breaks at the same quantity is ambiguous, and "is this a discount?" needs the
 * base price. Payload passes the array as the value and the merged document as
 * siblingData, so both are reachable in one function.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not require tiers to be in any
 * particular ORDER. Staff write price lists deepest-first as often as not, and
 * unitPriceForQty now picks the deepest qualifying break regardless of array
 * position — so ordering is a presentation matter, not a correctness one.
 * Refusing a save over row order would be inventing a rule to serve an
 * implementation detail that no longer exists.
 */

export type PriceTierRow = { minQty?: unknown; price?: unknown } | null | undefined;

/** Money as staff typed it, for a message they will recognise. */
const rupees = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

/**
 * @returns `true` when the tiers are usable, otherwise a staff-readable reason.
 */
export function validatePriceTiers(value: unknown, args?: unknown): true | string {
  const rows = Array.isArray(value) ? (value as PriceTierRow[]) : [];
  if (rows.length === 0) return true; // tiers are optional

  const sibling = (args as { siblingData?: { price?: unknown; moq?: unknown } } | undefined)?.siblingData;
  const basePrice = Number(sibling?.price);
  const hasBase = Number.isFinite(basePrice) && basePrice > 0;
  const moq = Number(sibling?.moq);
  // MOQ 1 constrains nothing beyond the minQty >= 1 rule below.
  const hasMoq = Number.isFinite(moq) && moq > 1;

  const seen = new Map<number, number>(); // minQty -> row number

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Tier ${i + 1}`;
    const minQty = Number(row?.minQty);
    const price = Number(row?.price);

    if (!Number.isFinite(minQty) || minQty < 1) {
      return `${label}: enter the quantity this price starts at — it must be 1 or more.`;
    }
    if (!Number.isInteger(minQty)) {
      return `${label}: the quantity must be a whole number, not ${minQty}.`;
    }
    if (!Number.isFinite(price)) {
      return `${label}: enter a price for this quantity.`;
    }
    if (price <= 0) {
      // The one that could produce a real paid order at an arbitrary discount.
      return `${label}: the price must be more than 0. Leave the tier out if there is no bulk price at this quantity.`;
    }
    if (hasBase && price > basePrice) {
      return `${label}: ${rupees(price)} is more than the normal price of ${rupees(
        basePrice,
      )}. A bulk tier has to be cheaper, or customers pay more for buying more.`;
    }

    if (hasMoq && minQty <= moq) {
      /*
       * INFERRED from MOQ semantics rather than a stated business rule.
       *
       * MOQ is the smallest quantity anyone can order, so a break at or below it
       * applies to EVERY possible order and the base price can never be charged.
       * The product page then prints the base row as an inverted range
       * ("10–1 pc") that reads as a rendering glitch, and bills the tier rate
       * forever. That state is incoherent rather than merely unusual, which is
       * why it is refused instead of warned about.
       */
      const normal = hasBase ? rupees(basePrice) : "the normal price";
      return `${label}: starts at ${minQty}, but the minimum order is ${moq} — so every order would get this price and ${normal} would never apply. Start the tier above ${moq}, or lower the minimum order quantity.`;
    }

    const clash = seen.get(minQty);
    if (clash !== undefined) {
      return `${label} and Tier ${clash}: both start at ${minQty}. Give each tier a different starting quantity.`;
    }
    seen.set(minQty, i + 1);
  }

  return true;
}
