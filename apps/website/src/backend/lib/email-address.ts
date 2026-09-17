/**
 * Email address syntax, stricter than the enquiry validator's regex.
 *
 * The validator accepts anything shaped `x@y.z`, which is the right bar for
 * "should this enquiry be filed" — a real customer with an unusual address must
 * never be turned away. It is the wrong bar for "should we send mail to this":
 * on 2026-09-03/04 the Resend log filled with auto-replies to addresses like
 * `FS@JFOWI.COM` that passed the loose check and bounced, and every bounce
 * counts against the metnmat.com sending reputation.
 *
 * Dependency-free on purpose so `email.ts` can use it without pulling DNS or
 * the rate limiter into every route that sends mail.
 */

// RFC 5322 atext plus the dot-separated "dot-atom" form; no quoted locals.
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
// A DNS label: alphanumeric, hyphens inside only, at most 63 characters.
const LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
// Public TLDs are alphabetic (IDN TLDs arrive punycode-encoded, `xn--…`).
const TLD = /^([A-Za-z]{2,63}|xn--[A-Za-z0-9-]{2,59})$/;

/** True when the address is well-formed enough that a delivery attempt is reasonable. */
export function emailSyntaxOk(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length < 6 || s.length > 254) return false;
  const at = s.indexOf("@");
  if (at < 1 || at !== s.lastIndexOf("@")) return false;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (local.length > 64 || !LOCAL.test(local)) return false;
  if (domain.length > 253) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => LABEL.test(l))) return false;
  return TLD.test(labels[labels.length - 1]!);
}

/** The domain part, lower-cased, or null when the address has no usable domain. */
export function emailDomain(raw: string): string | null {
  const s = raw.trim();
  const at = s.lastIndexOf("@");
  if (at < 0 || at === s.length - 1) return null;
  return s.slice(at + 1).toLowerCase();
}

/**
 * The key under which a per-address limit is counted.
 *
 * Lower-cased, and with a `+tag` stripped from the local part: plus-addressing
 * is how one mailbox becomes a hundred distinct "addresses", which is exactly
 * what a limit per address must not be fooled by. Two real people do not share
 * a mailbox, so folding the variants together costs nothing.
 */
export function emailLimitKey(raw: string): string {
  const s = raw.trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 0) return s;
  let local = s.slice(0, at);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  return `${local}@${s.slice(at + 1)}`;
}
