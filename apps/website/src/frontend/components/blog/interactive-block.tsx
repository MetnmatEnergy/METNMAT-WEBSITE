/**
 * The frame around an interactive model in an article: a numbered label, the
 * title, the model, and its caption. The config is validated HERE, on the
 * server, against the widget's zod schema; only a config that passes reaches
 * the client widget, and one that fails renders a visible "model unavailable"
 * panel listing the reasons.
 */
import { parseWidget } from "@/frontend/lib/widgets/schemas";
import { WidgetMount } from "./widgets/registry";
import { ModelUnavailable } from "./widgets/model-unavailable";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function InteractiveBlock({ fields, seq }: { fields: Record<string, unknown>; seq: number }) {
  const title = str(fields.title);
  const caption = str(fields.caption);
  const parsed = parseWidget(fields.widget, fields.config);
  return (
    <figure
      aria-label={title || `Interactive model ${seq}`}
      className="not-prose my-10 rounded-2xl border border-border bg-surface p-4 text-foreground sm:p-6"
    >
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Interactive model {seq}</p>
        {title && <p className="mt-1 font-display text-lg font-semibold leading-snug text-foreground">{title}</p>}
      </div>
      {parsed.ok ? <WidgetMount {...parsed.value} /> : <ModelUnavailable issues={parsed.issues} />}
      {caption && <figcaption className="mt-4 text-sm leading-relaxed text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
