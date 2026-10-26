/**
 * Network helpers for the weekly article pipeline: real papers for the brief
 * (OpenAlex), reference checks (Crossref) and the DeepSeek chat API. All three
 * take an injectable fetch so tests never touch the network.
 */
import type { Source } from "./lib";

type Fetch = typeof fetch;
const MAILTO = "dev@metnmat.com";
const UA = { "User-Agent": `metnmat-blog-pipeline/1.0 (mailto:${MAILTO})` };

/** OpenAlex stores abstracts as an inverted index; this rebuilds the text. */
export function abstractFromIndex(idx: Record<string, number[]> | null | undefined, maxWords = 120): string {
  if (!idx) return "";
  const words: string[] = [];
  for (const [w, positions] of Object.entries(idx)) for (const p of positions) words[p] = w;
  const text = words.filter(Boolean);
  return text.slice(0, maxWords).join(" ") + (text.length > maxWords ? " …" : "");
}

/** 10–15 well-cited papers with DOIs on the topic, for the SOURCES block of the brief. */
export async function findSources(query: string, doFetch: Fetch = fetch, limit = 12): Promise<Source[]> {
  const url =
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
    `&filter=has_doi:true,type:article&sort=cited_by_count:desc&per-page=${limit}` +
    `&select=doi,title,publication_year,authorships,primary_location,abstract_inverted_index&mailto=${MAILTO}`;
  try {
    const r = await doFetch(url, { headers: UA });
    if (!r.ok) return [];
    const j = (await r.json()) as { results?: Record<string, unknown>[] };
    return (j.results ?? []).map((w, i) => {
      const authors = ((w.authorships as { author?: { display_name?: string } }[]) ?? []).map((a) => a.author?.display_name).filter(Boolean) as string[];
      const loc = w.primary_location as { source?: { display_name?: string } } | null;
      return {
        n: i + 1,
        authors: authors.length > 3 ? `${authors.slice(0, 3).join(", ")} et al.` : authors.join(", "),
        title: String(w.title ?? ""),
        journal: loc?.source?.display_name ?? "",
        year: typeof w.publication_year === "number" ? w.publication_year : null,
        doi: String(w.doi ?? "").replace(/^https?:\/\/(dx\.)?doi\.org\//, ""),
        abstract: abstractFromIndex(w.abstract_inverted_index as Record<string, number[]> | null),
      };
    }).filter((s) => s.title && s.doi);
  } catch {
    return [];
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export function titleOverlap(a: string, b: string): number {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 3));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 3));
  if (!A.size) return 0;
  return [...A].filter((w) => B.has(w)).length / A.size;
}

export type RefVerdict = "doi-ok" | "doi-wrong" | "doi-missing-found" | "unverified";

/** "A. J. Bard, L. R. Faulkner" / "Allen J. Bard and Larry R. Faulkner" → "bard". */
export function firstSurname(authors: unknown): string {
  const first = String(authors ?? "").split(/,|;|\band\b|&/)[0] ?? "";
  const words = first.trim().split(/\s+/).filter((w) => !/^[A-Z]\.?$|^[A-Z]\.[A-Z]\.?/.test(w));
  return (words[words.length - 1] ?? "").toLowerCase().replace(/[^a-zÀ-ɏ-]/g, "");
}

type CrossrefWork = {
  title?: string[];
  DOI?: string;
  author?: { family?: string }[];
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
};

const STOP = new Set(["of", "the", "and", "for", "in", "on", "a", "an", "journal"]);
/**
 * Does the cited source name the journal Crossref files the work under? Abbreviations
 * count ("J. Chem. Educ." ↔ "Journal of Chemical Education"): every cited word must
 * be a prefix of some journal word, or the other way round.
 */
export function sourceMatches(cited: string, container: string): boolean {
  const words = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w));
  const a = words(cited);
  const b = words(container);
  if (!a.length || !b.length) return true; // nothing to compare: do not judge
  const hits = a.filter((t) => b.some((u) => u.startsWith(t) || t.startsWith(u))).length;
  return hits / a.length >= 0.6;
}

/**
 * Same work, not merely the same title: a book's title is shared by its reviews.
 * The pilot matched Bard & Faulkner to a review of it, and so did the first GitHub
 * dry run, through a 2002 review in the Russian Journal of Electrochemistry that
 * Crossref lists with no authors. So the first author, the year and, for a work
 * Crossref files in a journal, the journal must agree too, whenever both sides state them.
 */
function sameWork(ref: { title?: unknown; authors?: unknown; year?: unknown; source?: unknown }, w: CrossrefWork, minOverlap: number): boolean {
  if (titleOverlap(String(ref.title ?? ""), w.title?.[0] ?? "") < minOverlap) return false;
  const container = w["container-title"]?.[0] ?? "";
  if (container && ref.source && !sourceMatches(String(ref.source), container)) return false;
  const surname = firstSurname(ref.authors);
  const families = (w.author ?? []).map((a) => (a.family ?? "").toLowerCase());
  if (surname && families.length && !families.some((f) => f.includes(surname) || surname.includes(f))) return false;
  const year = typeof ref.year === "number" ? ref.year : Number(ref.year);
  const wy = w.issued?.["date-parts"]?.[0]?.[0];
  if (Number.isFinite(year) && year > 0 && wy && Math.abs(wy - year) > 1) return false;
  return true;
}

/**
 * A DOI that resolves to a different work is the dangerous case (it looks
 * checked and is not), so the caller strips it. A reference with no DOI that
 * Crossref can match gains its DOI. Books often cannot be matched; they stay.
 */
export async function checkReference(
  ref: { title?: unknown; doi?: unknown; authors?: unknown; year?: unknown; source?: unknown },
  doFetch: Fetch = fetch,
): Promise<{ verdict: RefVerdict; doi?: string }> {
  const title = String(ref.title ?? "");
  const doi = String(ref.doi ?? "").replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();
  try {
    if (doi) {
      const r = await doFetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: UA });
      if (r.status === 404) return { verdict: "doi-wrong" };
      if (!r.ok) return { verdict: "unverified", doi };
      const m = ((await r.json()) as { message?: CrossrefWork }).message ?? {};
      return sameWork(ref, m, 0.5) ? { verdict: "doi-ok", doi } : { verdict: "doi-wrong" };
    }
    const q = encodeURIComponent(`${title} ${String(ref.authors ?? "")}`.slice(0, 250));
    const r = await doFetch(`https://api.crossref.org/works?query.bibliographic=${q}&rows=5`, { headers: UA });
    if (!r.ok) return { verdict: "unverified" };
    const items = ((await r.json()) as { message?: { items?: CrossrefWork[] } }).message?.items ?? [];
    const match = items.find((it) => it.DOI && sameWork(ref, it, 0.8));
    return match?.DOI ? { verdict: "doi-missing-found", doi: match.DOI } : { verdict: "unverified" };
  } catch {
    return { verdict: "unverified", doi: doi || undefined };
  }
}

export type ChatResult = { content: string; usage: Record<string, unknown> | null; finish: string | null; seconds: number };

/** DeepSeek chat completion, streamed so long thinking never hits a header timeout. */
export async function deepseekChat(
  opts: { key: string; model: string; messages: { role: string; content: string }[]; json?: boolean; maxTokens?: number; effort?: "low" | "high" | "max" },
  doFetch: Fetch = fetch,
): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: opts.maxTokens ?? 32000,
  };
  if (opts.effort) body.reasoning_effort = opts.effort;
  if (opts.json) body.response_format = { type: "json_object" };
  const t0 = Date.now();
  const res = await doFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let content = "";
  let usage: Record<string, unknown> | null = null;
  let finish: string | null = null;
  let buf = "";
  const dec = new TextDecoder();
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      const j = JSON.parse(data) as { choices?: { delta?: { content?: string }; finish_reason?: string }[]; usage?: Record<string, unknown> };
      const c = j.choices?.[0];
      if (c?.delta?.content) content += c.delta.content;
      if (c?.finish_reason) finish = c.finish_reason;
      if (j.usage) usage = j.usage;
    }
  }
  return { content, usage, finish, seconds: (Date.now() - t0) / 1000 };
}

/** Parses a model's JSON answer, tolerating a ``` fence around it. */
export function parseModelJson<T>(s: string): T {
  return JSON.parse(s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")) as T;
}
