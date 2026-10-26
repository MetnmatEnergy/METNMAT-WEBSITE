/**
 * Pure helpers for the weekly article pipeline (scripts/blog/weekly.ts).
 * Everything here is deterministic and covered by test/blog-weekly.test.ts;
 * network calls live in weekly.ts and sources.ts.
 */
import { WIDGET_IDS, parseWidget } from "../../apps/website/src/frontend/lib/widgets/schemas";
import { ZERO_C_IN_K, coLine, crossingK, equilibriumLog10Ratio, oxideName, reductantOf, type EllinghamLine } from "../../apps/website/src/frontend/lib/widgets/ellingham-math";
import { parseFormula, speciesTerm, stableAt } from "../../apps/website/src/frontend/lib/widgets/pourbaix-math";
import { analyseCv, matsudaAyabe, randlesSevcikUa, simulateCv } from "../../apps/website/src/frontend/lib/widgets/cv-sim";
import { compileExpr } from "../../apps/website/src/frontend/lib/widgets/expr";

export { WIDGET_IDS, parseWidget };

// ── master prompt ────────────────────────────────────────────────────────────

/** The text between <!-- BEGIN id --> and <!-- END id --> in docs/blog/MASTER-PROMPT.md. */
export function promptBlock(md: string, id: string): string {
  const m = md.match(new RegExp(`<!-- BEGIN ${id} -->\\r?\\n([\\s\\S]*?)\\r?\\n<!-- END ${id} -->`));
  if (!m) throw new Error(`MASTER-PROMPT.md has no "${id}" block`);
  return m[1]!;
}

/** Keeps only the widget-library entries the website can actually draw. */
export function builtWidgetLibrary(block: string, built: readonly string[] = WIDGET_IDS): string {
  // One entry per line: "- id: …" or "- id (note): …".
  const entries = block.split(/\r?\n(?=- [a-z-]+[\s(:])/);
  return entries.filter((e) => built.includes(/^- ([a-z-]+)[\s(:]/.exec(e)?.[1] ?? "")).join("\n");
}

export const AUTONOMOUS_ADDENDUM = `
AUTONOMOUS MODE (this overrides anything above that assumes a human editor)
No person will edit this article before it is published. Therefore:
- Do not write [EDITOR: …] lines; leave "editor_slots" empty.
- Do not use {{figure:…}} placeholders; there are no images.
- Use only the widget types listed in the library above, never "new".
- Anything you would have put in "verify" must either be stated in a form you are certain of, or left out. Leave "verify" empty.
- Cite only works from the SOURCES list in the brief, or standard textbooks you are certain exist. A reference you are unsure of is worse than none.
- Every number about the interactive model (crossing temperatures, boundary potentials, peak currents) must agree with the model's own config.`;

export function systemPrompt(md: string, categories: string, contentTypes: string): string {
  return (
    promptBlock(md, "system")
      .replace("{WIDGET_LIBRARY}", builtWidgetLibrary(promptBlock(md, "widgets")))
      .replace("{CATEGORIES}", categories)
      .replace("{CONTENT_TYPES}", contentTypes) + AUTONOMOUS_ADDENDUM
  );
}

// ── topic bank ───────────────────────────────────────────────────────────────

export type Topic = { n: number; topic: string; pillar: string; archetype: string; widget: string };

/** The 52-row table under "## D. Topic bank" in MASTER-PROMPT.md. */
export function parseTopicBank(md: string): Topic[] {
  const section = md.split(/^## D\. /m)[1]?.split(/^## E\. /m)[0] ?? "";
  const out: Topic[] = [];
  for (const line of section.split(/\r?\n/)) {
    const c = line.split("|").map((s) => s.trim());
    if (c.length < 7 || !/^\d+$/.test(c[1]!)) continue;
    out.push({ n: Number(c[1]), topic: c[2]!, pillar: c[3]!, archetype: c[4]!, widget: c[5]! });
  }
  return out;
}

/** Topic numbers already used, read from the posts' referenceNumber ("MI-T01", "MI-T01 MI-T06"). */
export function usedTopics(posts: { referenceNumber?: string | null }[]): Set<number> {
  const used = new Set<number>();
  for (const p of posts) for (const m of (p.referenceNumber ?? "").matchAll(/MI-T(\d+)/g)) used.add(Number(m[1]));
  return used;
}

export function nextTopic(topics: Topic[], used: Set<number>, override?: number): Topic | null {
  if (override) return topics.find((t) => t.n === override) ?? null;
  return [...topics].sort((a, b) => a.n - b.n).find((t) => !used.has(t.n)) ?? null;
}

export const topicRef = (n: number) => `MI-T${String(n).padStart(2, "0")}`;

/** The next Thursday 10:00 IST (04:30 UTC) strictly after `now`. */
export function nextThursdayIst(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 30));
  const add = (4 - d.getUTCDay() + 7) % 7; // 4 = Thursday
  d.setUTCDate(d.getUTCDate() + add);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

const READER: Record<string, string> = {
  electrochemistry: "M.Sc and PhD students running electrochemistry experiments; R&D engineers in sensor, battery and electrolyzer companies",
  energy: "researchers and engineers in hydrogen, fuel-cell and battery development; final-year students",
  corrosion: "corrosion and materials engineers in industry; final-year metallurgy and chemistry students",
  extractive: "final-year metallurgy and chemical engineering students; process engineers in steel and non-ferrous plants",
  physical: "metallurgy and materials students; heat-treatment and materials engineers in industry",
  characterisation: "PhD students and lab scientists who run and interpret measurements",
  history: "students and engineers who like the story behind the science",
};

export type Source = { n: number; authors: string; title: string; journal: string; year: number | null; doi: string; abstract: string };

export function brief(opts: {
  topic: Topic;
  week: string;
  recent: { title: string; excerpt?: string | null }[];
  sources: Source[];
}): string {
  const { topic, week, recent, sources } = opts;
  const pref = (WIDGET_IDS as readonly string[]).includes(topic.widget) ? topic.widget : "function-plot";
  return [
    `WEEK: ${week}`,
    `PILLAR: ${topic.pillar}`,
    `TOPIC: ${topic.topic}`,
    `ARCHETYPE: ${topic.archetype}`,
    `PRIMARY READER: ${READER[topic.pillar] ?? "students, researchers and industry engineers"}`,
    "HOOK IDEAS (optional): your choice; it must be true and checkable.",
    "MUST COVER: what a specialist in this topic would be annoyed to see missing.",
    `WIDGET PREFERENCE: ${pref}`,
    "CATALOGUE (optional, at most one may be mentioned): none this week.",
    "SOURCES (cite only from these, or standard textbooks you are certain of):",
    ...(sources.length
      ? sources.map((s) => `[${s.n}] ${s.authors} (${s.year ?? "n.d."}). ${s.title}. ${s.journal}. doi:${s.doi}${s.abstract ? `\n    Abstract: ${s.abstract}` : ""}`)
      : ["(none found this week; rely on standard textbooks)"]),
    "RECENT ARTICLES (do not repeat their openings, structures or headings):",
    ...recent.slice(0, 6).map((r) => `${r.title}${r.excerpt ? ` — ${r.excerpt}` : ""}`),
  ].join("\n");
}

// ── text checks ──────────────────────────────────────────────────────────────

export const BANNED = [
  "delve", "dive into", "deep dive", "tapestry", "landscape", "realm", "testament", "pivotal", "crucial", "vital",
  "paramount", "game-changer", "revolutioniz", "revolutionis", "unlock", "unleash", "harness the power", "leverage",
  "seamless", "robust", "cutting-edge", "state-of-the-art", "ever-evolving", "fast-paced", "navigate the complexities",
  "important to note", "worth noting", "interestingly", "notably", "moreover", "furthermore", "in conclusion",
  "in summary", "to sum up", "at the end of the day", "myriad", "embark", "shed light", "stands as",
  "serves as a reminder", "not just",
];
export const bannedIn = (text: string): string[] => BANNED.filter((p) => text.toLowerCase().includes(p));

export const wordCount = (md: string): number => md.replace(/\$\$[\s\S]*?\$\$/g, " ").split(/\s+/).filter(Boolean).length;

/**
 * Trims to `max` characters, preferring the end of a sentence (a subtitle cut
 * mid-sentence went live on 2026-10-26 ending "…in concrete. Both"), then a word
 * boundary, without a dangling separator.
 */
export function clip(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  const sentence = /^[\s\S]*[.!?](?=\s)/.exec(t.slice(0, max + 1))?.[0];
  if (sentence && sentence.length > max / 2) return sentence.trim();
  const atWord = t.slice(0, max + 1).replace(/\s+\S*$/, "");
  // No space to break at (one long word): cut hard.
  const cut = atWord.length <= max && atWord.length > max / 2 ? atWord : t.slice(0, max);
  return cut.replace(/[\s,;:–—-]+$/, "");
}

export type Article = {
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  abstract?: string;
  seoTitle?: string;
  metaDescription?: string;
  primaryCategory?: string;
  contentType?: string;
  researchArea?: string;
  keywords?: string;
  tags?: string[];
  body_markdown: string;
  widget?: { id?: string; type?: string; title?: string; caption?: string; config?: unknown };
  references?: Record<string, unknown>[];
  linkedin_post?: string;
  [k: string]: unknown;
};

/** Hard limits the CMS and search engines care about; fixes what can be fixed silently. */
export function normaliseArticle(a: Article): Article {
  return {
    ...a,
    title: clip(a.title, 70),
    subtitle: a.subtitle ? clip(a.subtitle, 160) : undefined,
    slug: (a.slug || a.title)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, ""),
    excerpt: clip(a.excerpt, 200),
    seoTitle: a.seoTitle ? clip(a.seoTitle, 60) : undefined,
    metaDescription: a.metaDescription ? clip(a.metaDescription, 155) : undefined,
    tags: (a.tags ?? []).slice(0, 6),
    body_markdown: a.body_markdown
      .split(/\r?\n/)
      .filter((l) => !/^\s*\[EDITOR:/i.test(l))
      .join("\n")
      .replace(/^\s*\{\{figure:[^}]*\}\}\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n"),
  };
}

/** Reasons the article must not go out unattended. Empty = fit to publish. */
export function blockers(a: Article): string[] {
  const out: string[] = [];
  const words = wordCount(a.body_markdown);
  if (words < 1200) out.push(`body is only ${words} words`);
  if (!a.body_markdown.includes("{{widget:")) out.push("the article has no interactive model");
  if (!a.widget?.type) out.push("no widget was returned");
  else {
    const r = parseWidget(a.widget.type, a.widget.config);
    if (!r.ok) out.push(`widget config invalid: ${r.issues.join("; ")}`);
  }
  if (!a.title || !a.excerpt) out.push("title or excerpt missing");
  return out;
}

// ── ground truth from the model, for the review pass ─────────────────────────

const f = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : "–");

/**
 * Numbers computed by the website's own reviewed widget code from the widget
 * config. The review pass checks the article's text against these, which is
 * how the pipeline catches a sentence that contradicts its own diagram.
 */
export function widgetFacts(widget: string, config: unknown): string[] {
  const parsed = parseWidget(widget, config);
  if (!parsed.ok) return [`(the widget config is invalid: ${parsed.issues.join("; ")})`];
  const v = parsed.value;
  const out: string[] = [];
  if (v.widget === "ellingham") {
    const lines = v.config.lines as EllinghamLine[];
    const reductants = lines.filter((l) => reductantOf(l.label));
    const oxides = lines.filter((l) => !reductantOf(l.label));
    const co = coLine(lines);
    for (const r of [...reductants, ...(co && !reductants.includes(co) ? [co] : [])]) {
      for (const o of oxides) {
        const T = crossingK(r, o);
        if (T && T > Math.max(r.validFromK, o.validFromK) && T < Math.min(r.validToK, o.validToK)) {
          out.push(`${r.label} crosses ${oxideName(o.label)} at ${f(T)} K (${f(T - ZERO_C_IN_K)} °C)`);
        }
      }
    }
    for (let i = 0; i < reductants.length; i++)
      for (let j = i + 1; j < reductants.length; j++) {
        const T = crossingK(reductants[i]!, reductants[j]!);
        if (T && T > 0 && T < 3000) out.push(`${reductants[i]!.label} crosses ${reductants[j]!.label} at ${f(T)} K (${f(T - ZERO_C_IN_K)} °C)`);
      }
    const h2 = lines.find((l) => reductantOf(l.label) === "H2");
    for (const TC of [600, 900, 1200]) {
      const T = TC + ZERO_C_IN_K;
      for (const o of oxides) {
        if (T < o.validFromK || T > o.validToK) continue;
        const bits: string[] = [];
        if (h2) bits.push(`pH₂/pH₂O ≥ ${f(Math.pow(10, equilibriumLog10Ratio(h2, o, T)), 2)}`);
        if (co) bits.push(`pCO/pCO₂ ≥ ${f(Math.pow(10, equilibriumLog10Ratio(co, o, T)), 2)}`);
        if (bits.length) out.push(`At ${TC} °C, reducing ${oxideName(o.label)} needs ${bits.join(" and ")}`);
      }
    }
  } else if (v.widget === "pourbaix") {
    const c = v.config;
    const terms = c.species.map((sp) => speciesTerm(sp, parseFormula(sp.formula, c.element) as Exclude<ReturnType<typeof parseFormula>, string>, c.logActivity.default));
    for (const pH of [0, 4, 7, 10, 14]) {
      if (pH < c.pHRange[0] || pH > c.pHRange[1]) continue;
      const seq: string[] = [];
      let prev = -1;
      for (let E = c.ERange_V[0]; E <= c.ERange_V[1] + 1e-9; E += 0.002) {
        const s = stableAt(terms, pH, E);
        if (s !== prev) seq.push(`${c.species[s]!.label}${prev === -1 ? "" : ` from ${f(E, 2)} V`}`);
        prev = s;
      }
      out.push(`At pH ${pH} (activity 10^${c.logActivity.default}), going up in potential: ${seq.join(" → ")}`);
    }
  } else if (v.widget === "cyclic-voltammetry") {
    const c = v.config;
    const p = { mechanism: c.mechanism, n: c.n, E0_V: c.E0_V, k0_cm_s: c.k0_cm_s, alpha: c.alpha, D_cm2_s: c.D_cm2_s, C_mM: c.C_mM, area_cm2: c.area_cm2, scanRate_V_s: c.scanRate_V_s.default, window_V: c.window_V, kc_s: c.kc_s };
    const a = analyseCv(simulateCv(p));
    const ma = matsudaAyabe(p);
    out.push(`At ${c.scanRate_V_s.default} V/s: Randles–Ševčík peak current ${f(randlesSevcikUa(p), 2)} µA; simulated cathodic peak ${a.cathodic ? `${f(-a.cathodic.I_uA, 2)} µA at ${f(a.cathodic.E_V, 3)} V` : "none"}; ΔEp ${a.deltaEp_V === null ? "–" : `${f(a.deltaEp_V * 1000)} mV`}; Matsuda–Ayabe Λ ${f(ma.lambda, 2)} (${ma.regime})`);
  } else if (v.widget === "function-plot") {
    const c = v.config;
    const vars: Record<string, number> = Object.fromEntries(c.params.map((q) => [q.symbol, q.default]));
    const xs = [0, 0.25, 0.5, 0.75, 1].map((t) => c.x.min + t * (c.x.max - c.x.min));
    for (const cv of c.curves) {
      const r = compileExpr(cv.expr, [c.x.symbol, ...c.params.map((q) => q.symbol)]);
      if (!r.ok) continue;
      out.push(`${cv.label} at the default sliders: ${xs.map((x) => `${c.x.symbol}=${f(x, 3)} → ${f(r.fn({ ...vars, [c.x.symbol]: x }), 4)}`).join("; ")}`);
    }
  }
  return out;
}
