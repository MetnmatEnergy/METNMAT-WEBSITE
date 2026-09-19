/**
 * The strip shown while a staff browser is in draft mode.
 *
 * It used to say "Draft preview — this version is not public" for EVERY page
 * opened while the CMS preview cookie was set, published ones included, which
 * read as "my product is not live" (owner, 2026-09-19). Now it says which of
 * the two situations this is, and offers the way out that did not exist:
 * /api/preview/exit clears the cookie and returns here.
 */
export function PreviewBanner({ published, path }: { published: boolean; path: string }) {
  const exit = `/api/preview/exit?to=${encodeURIComponent(path)}`;
  if (published) {
    return (
      <div
        role="status"
        className="mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-4 py-2 text-center text-sm text-foreground"
      >
        <span>
          <strong>Preview mode.</strong> This page is <strong>published and live</strong> for customers; you are
          seeing it through the CMS preview link.
        </span>
        <a href={exit} className="font-semibold text-brand underline underline-offset-2">
          Exit preview
        </a>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-foreground"
    >
      <span>Draft preview — this version is not public yet. Press Publish in the CMS to make it live.</span>
      <a href={exit} className="underline underline-offset-2">
        Exit preview
      </a>
    </div>
  );
}
