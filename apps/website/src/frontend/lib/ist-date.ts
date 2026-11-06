/**
 * Customer-facing dates and times, always in India Standard Time.
 *
 * The production server's clock is UTC, and these pages render on the server,
 * so a formatter that leaves the zone implicit prints every timestamp 5½ hours
 * early (an order paid at 4:36 pm IST read "11:07 am"), and anything between
 * midnight and 5:30 am IST lands on the previous day. That includes the date on
 * the GST invoice. Every date a customer sees goes through here, so the zone is
 * never left to whichever machine renders the page.
 */
const IST = "Asia/Kolkata";

const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: IST };
const DATE_TIME: Intl.DateTimeFormatOptions = { ...DATE, hour: "2-digit", minute: "2-digit", hour12: true };

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "27 Oct 2026" in IST; "" when the value is missing or unparseable. */
export function formatDateIST(iso?: string | null): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString("en-IN", DATE) : "";
}

/** "27 Oct 2026, 04:36 pm" in IST; "" when the value is missing or unparseable. */
export function formatDateTimeIST(iso?: string | null): string {
  const d = parse(iso);
  return d ? d.toLocaleString("en-IN", DATE_TIME) : "";
}
