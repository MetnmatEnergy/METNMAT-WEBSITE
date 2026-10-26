/**
 * What a reader sees instead of an interactive model whose config failed its
 * schema (server) or whose code threw while drawing (client error boundary).
 * The reasons are listed so the editor can fix the config from the preview.
 */
export function ModelUnavailable({ issues }: { issues: string[] }) {
  return (
    <div role="note" className="rounded-xl border border-dashed border-border bg-muted/40 p-5 text-sm">
      <p className="font-medium text-foreground">Interactive model unavailable</p>
      <p className="mt-1 text-muted-foreground">
        This model could not be drawn from its settings. The article text still stands on its own.
      </p>
      {issues.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline">
            Why (for the editor)
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs text-muted-foreground">
            {issues.map((m, i) => (
              <li key={i} className="break-words">
                {m}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
