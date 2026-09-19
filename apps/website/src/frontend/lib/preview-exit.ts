/**
 * Where /api/preview/exit may send the browser after switching draft mode off.
 *
 * Only a same-origin path: a bare "/" followed by anything that is not a second
 * slash (which would make "//evil.example" a protocol-relative URL) and no
 * scheme. Anything else falls back to the home page. Pure, so it is unit-tested
 * without a request.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(value) || /^\/[^?#]*:/.test(value)) return "/";
  return value;
}
