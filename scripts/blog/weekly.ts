/**
 * The weekly METNMAT Insights article, end to end, with no person in the loop:
 *
 *   topic bank → real papers (OpenAlex) → DeepSeek draft → widget config repair
 *   → reference check (Crossref) → DeepSeek scientific review against numbers
 *   computed by the website's own widget code → hard checks → POST to the CMS.
 *
 * The CMS publishes it immediately, schedules it, or keeps it as a draft
 * (BLOG_PUBLISH_MODE). Anything that fails a hard check is filed as a draft and
 * the notification email says why, so a broken article never goes out.
 *
 * Run by .github/workflows/blog-weekly.yml:
 *   pnpm --filter dashboard exec tsx ../../scripts/blog/weekly.ts
 * Environment: DEEPSEEK_API_KEY, CMS_BLOG_INGEST_KEY, CMS_URL, BLOG_PUBLISH_MODE,
 * BLOG_TOPIC, BLOG_ARTICLE_DIR (publish a prepared article instead of generating
 * one), BLOG_DRY_RUN, BLOG_OUT_DIR. Secrets are never printed.
 */
import fs from "node:fs";
import path from "node:path";
import {
  BANNED,
  bannedIn,
  blockers,
  brief,
  nextThursdayIst,
  nextTopic,
  normaliseArticle,
  parseTopicBank,
  parseWidget,
  promptBlock,
  systemPrompt,
  topicRef,
  usedTopics,
  widgetFacts,
  wordCount,
  type Article,
} from "./lib";
import { checkReference, deepseekChat, findSources, parseModelJson } from "./sources";
import { coverWebp, renderCoverSvg } from "./cover";
import crypto from "node:crypto";

/** The monorepo root: tsx runs this from apps/dashboard, and import.meta is not available in its CJS mode. */
function findRoot(from = process.cwd()): string {
  for (let d = path.resolve(from); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, "pnpm-workspace.yaml"))) return d;
    if (path.dirname(d) === d) throw new Error("not inside the monorepo (no pnpm-workspace.yaml found)");
  }
}
const ROOT = findRoot();
const env = (k: string) => (process.env[k] ?? "").trim();
const CMS = (env("CMS_URL") || "https://admin.metnmat.com").replace(/\/+$/, "");
const MODE = (env("BLOG_PUBLISH_MODE") || "scheduled") as "draft" | "scheduled" | "immediate";
const DRY = env("BLOG_DRY_RUN") === "true";
const OUT = path.resolve(ROOT, env("BLOG_OUT_DIR") || "out/blog");
const PRO = "deepseek-v4-pro";
const FLASH = "deepseek-flash";

const log = (...a: unknown[]) => console.log("[blog]", ...a);
const usage: { step: string; model: string; seconds: number; usage: unknown }[] = [];

type State = {
  posts: { slug: string; title: string; excerpt?: string | null; pipelineTopics?: string | null; referenceNumber?: string | null; status: string; publishedDate?: string | null }[];
  categories: { slug: string; name: string }[];
  contentTypes: { slug: string; name: string }[];
};
type Widgets = Record<string, { widget: string; title?: string; caption?: string; config: unknown }>;

async function cms<T>(method: "GET" | "POST", route: string, body?: unknown): Promise<{ status: number; data: T }> {
  const key = env("CMS_BLOG_INGEST_KEY");
  if (!key) throw new Error("CMS_BLOG_INGEST_KEY is not set");
  const r = await fetch(`${CMS}/api/posts/${route}`, {
    method,
    headers: { "x-ingest-key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`CMS ${route} answered ${r.status} with non-JSON: ${text.slice(0, 200)}`);
  }
  return { status: r.status, data };
}

async function chat(step: string, model: string, messages: { role: string; content: string }[], effort: "low" | "high") {
  const key = env("DEEPSEEK_API_KEY");
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await deepseekChat({ key, model, messages, json: true, effort, maxTokens: effort === "low" ? 16000 : 48000 });
      usage.push({ step, model, seconds: r.seconds, usage: r.usage });
      log(`${step}: ${r.seconds.toFixed(0)} s, finish ${r.finish}`);
      if (r.finish === "length" || !r.content.trim()) throw new Error("the model ran out of tokens before answering");
      return r.content;
    } catch (e) {
      log(`${step} attempt ${attempt} failed: ${(e as Error).message}`);
      if (attempt === 2) throw e;
    }
  }
  throw new Error("unreachable");
}

/** Asks for a corrected widget config until it passes the website's schema (two tries). */
async function repairWidget(a: Article, library: string): Promise<string[]> {
  const notes: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = parseWidget(a.widget?.type, a.widget?.config);
    if (r.ok) return notes;
    notes.push(`widget config repaired (attempt ${attempt}): ${r.issues.join("; ")}`);
    const raw = await chat(`widget-repair-${attempt}`, FLASH, [
      {
        role: "user",
        content: [
          `This config for the "${a.widget?.type}" interactive model fails validation.`,
          `Errors:\n${r.issues.map((i) => `- ${i}`).join("\n")}`,
          `The widget library contract:\n${library}`,
          `The article's central idea: ${String((a.self_check as { central_idea?: string } | undefined)?.central_idea ?? a.title)}`,
          `Current config:\n${JSON.stringify(a.widget?.config, null, 2)}`,
          'Return one JSON object {"config": {...}} with a corrected config. Keep the physics and the article\'s intent; change only what the errors require.',
        ].join("\n\n"),
      },
    ], "low");
    a.widget = { ...a.widget, config: parseModelJson<{ config: unknown }>(raw).config };
  }
  return notes;
}

async function checkReferences(a: Article): Promise<string[]> {
  const notes: string[] = [];
  for (const ref of a.references ?? []) {
    const v = await checkReference(ref);
    if (v.verdict === "doi-wrong") {
      notes.push(`DOI removed from "${String(ref.title).slice(0, 80)}": it does not resolve to that work`);
      delete ref.doi;
    } else if (v.verdict === "doi-missing-found" && v.doi) {
      ref.doi = v.doi;
    }
  }
  return notes;
}

const REVIEW_PROMPT = `You are the scientific editor of METNMAT Insights. No other person will read this article before it is published, so you are the last check. You receive the article as JSON, FACTS computed by the website's own reviewed code from the article's interactive model, and automatic CHECKS.

Do this:
1. Find every scientific or factual error: wrong numbers, signs or directions; wrong boundary conditions or derivations; standard-state results presented as absolute limits; history told inaccurately; unit errors; estimates that do not follow from the conditions the article itself states (recompute them).
2. Make every statement about the interactive model agree with FACTS. Where text and FACTS disagree, FACTS win, unless the config itself is physically wrong; then fix the config and the text together.
3. Delete anything you cannot stand behind. Do not add new claims you cannot verify.
4. Fix every CHECKS problem.
5. Enforce the register: formal scientific prose that a researcher from an adjacent field can follow; an introduction that states the problem, its significance and the article's aims within its first two paragraphs; numbered, descriptive section headings ("2. Thermodynamic basis", not slogans or questions); asides labelled **Further detail.**, **Industrial relevance.** or **Laboratory note.**; no anecdotal hooks, humour, rhetorical questions, conversational phrasing or em-dashes. Rewrite any passage that falls short.
6. Keep the structure and the length (body 2,200–3,300 words). Change only what needs changing. Do not introduce any of these phrases: ${BANNED.join(", ")}.

Return the complete corrected article as one JSON object with exactly the input article's keys, plus "review_notes": an array of one-line descriptions of each change you made.`;

function summary(lines: string[]) {
  const file = env("GITHUB_STEP_SUMMARY");
  if (file) fs.appendFileSync(file, lines.join("\n") + "\n");
}

async function generate(state: State | null, masterPrompt: string): Promise<{ article: Article; widgets: Widgets; ref: string; notes: string[] }> {
  const topics = parseTopicBank(masterPrompt);
  const topic = nextTopic(topics, usedTopics(state?.posts ?? []), Number(env("BLOG_TOPIC")) || undefined);
  if (!topic) throw new Error("every topic in the bank has been used; add rows to part D of MASTER-PROMPT.md");
  log(`topic ${topic.n}: ${topic.topic}`);

  const sources = await findSources(topic.topic.replace(/[:'"]/g, " "));
  log(`${sources.length} sources from OpenAlex`);
  const cats = state?.categories.map((c) => c.slug).join(", ") || "electrochemistry, metallurgy, materials, hydrogen-fuel-cells, lab-equipment, r-d, insights";
  const types = state?.contentTypes.map((c) => c.slug).join(", ") || "technical-article, engineering-guide, review-article, research-note";
  const now = new Date();
  const week = `${now.getUTCFullYear()}-W${String(Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
  const recent = (state?.posts ?? []).filter((p) => p.status === "published").map((p) => ({ title: p.title, excerpt: p.excerpt }));
  const library = promptBlock(masterPrompt, "widgets");

  const draftRaw = await chat("article", PRO, [
    { role: "system", content: systemPrompt(masterPrompt, cats, types) },
    { role: "user", content: brief({ topic, week, recent, sources }) },
  ], "high");
  let a = normaliseArticle(parseModelJson<Article>(draftRaw));
  const notes: string[] = [];
  notes.push(...(await repairWidget(a, library)));
  notes.push(...(await checkReferences(a)));

  const checks = {
    banned_phrases: bannedIn(a.body_markdown + " " + (a.linkedin_post ?? "")),
    body_words: wordCount(a.body_markdown),
    widget_valid: parseWidget(a.widget?.type, a.widget?.config).ok,
  };
  const facts = a.widget?.type ? widgetFacts(a.widget.type, a.widget.config) : [];
  try {
    const reviewedRaw = await chat("review", PRO, [
      { role: "system", content: REVIEW_PROMPT },
      { role: "user", content: JSON.stringify({ article: a, FACTS: facts, CHECKS: checks }, null, 1) },
    ], "high");
    const reviewed = parseModelJson<Article & { review_notes?: string[] }>(reviewedRaw);
    if (reviewed.body_markdown && reviewed.title) {
      notes.push(...(reviewed.review_notes ?? []).map((n) => `review: ${n}`));
      delete reviewed.review_notes;
      a = normaliseArticle({ ...a, ...reviewed });
      notes.push(...(await repairWidget(a, library)));
    }
  } catch (e) {
    notes.push(`review pass failed, the unreviewed draft was used: ${(e as Error).message}`);
  }

  const id = /\{\{widget:([A-Za-z0-9_-]+)\}\}/.exec(a.body_markdown)?.[1] ?? "main";
  const widgets: Widgets = a.widget?.type ? { [id]: { widget: a.widget.type, title: a.widget.title, caption: a.widget.caption, config: a.widget.config } } : {};
  return { article: a, widgets, ref: topicRef(topic.n), notes };
}

function loadPrepared(dir: string): { article: Article; widgets: Widgets; ref: string; notes: string[] } {
  const abs = path.resolve(ROOT, dir);
  const meta = JSON.parse(fs.readFileSync(path.join(abs, "meta.json"), "utf8")) as Article & { pipelineTopics?: string; referenceNumber?: string };
  const widgets = JSON.parse(fs.readFileSync(path.join(abs, "widgets.json"), "utf8")) as Widgets;
  const body = fs.readFileSync(path.join(abs, "article.md"), "utf8");
  const first = Object.values(widgets)[0];
  const article = normaliseArticle({ ...meta, body_markdown: body, widget: first ? { type: first.widget, config: first.config } : undefined });
  return { article, widgets, ref: meta.pipelineTopics ?? meta.referenceNumber ?? "", notes: ["prepared article, edited and checked by hand before upload"] };
}

async function main() {
  const masterPrompt = fs.readFileSync(path.join(ROOT, "docs/blog/MASTER-PROMPT.md"), "utf8");
  const state = env("CMS_BLOG_INGEST_KEY") ? (await cms<State>("GET", "ingest-state")).data : null;
  if (state && !Array.isArray(state.posts)) throw new Error(`ingest-state failed: ${JSON.stringify(state).slice(0, 200)}`);

  const prepared = env("BLOG_ARTICLE_DIR");
  const { article, widgets, ref, notes } = prepared ? loadPrepared(prepared) : await generate(state, masterPrompt);

  // Every widget must pass the website's schema; the article must clear the hard checks.
  const problems = [...blockers(article)];
  for (const [id, w] of Object.entries(widgets)) {
    const r = parseWidget(w.widget, w.config);
    if (!r.ok) problems.push(`widget "${id}" invalid: ${r.issues.join("; ")}`);
  }
  const banned = bannedIn(article.body_markdown);
  if (banned.length) notes.push(`phrases on the banned list still present: ${banned.join(", ")}`);
  const mode = problems.length ? "draft" : MODE;
  if (problems.length) notes.unshift(...problems.map((p) => `HELD AS DRAFT: ${p}`));
  const at = mode === "scheduled" ? nextThursdayIst(new Date()).toISOString() : undefined;

  fs.mkdirSync(OUT, { recursive: true });
  const stem = path.join(OUT, `${new Date().toISOString().slice(0, 10)}-${article.slug}`);
  fs.writeFileSync(`${stem}.json`, JSON.stringify({ article, widgets, ref, notes, mode, at, usage }, null, 2));

  // The thumbnail: the article's own diagrams beside its title.
  let cover: { data: string; mimeType: string; filename: string; alt: string } | undefined;
  try {
    const catName = (slug?: unknown) => {
      const s = String(slug ?? "");
      return state?.categories.find((c) => c.slug === s)?.name ?? s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    };
    const kicker = [article.primaryCategory, ...((article.secondaryCategories as string[] | undefined) ?? [])].filter(Boolean).map(catName).join(" · ");
    const panels = Object.values(widgets).filter((w) => parseWidget(w.widget, w.config).ok);
    const webp = await coverWebp(renderCoverSvg({ title: article.title, kicker, widgets: panels }));
    fs.writeFileSync(`${stem}.webp`, webp);
    const NAMES: Record<string, string> = { ellingham: "an Ellingham diagram", pourbaix: "a Pourbaix diagram", "cyclic-voltammetry": "a simulated cyclic voltammogram", "function-plot": "a plot" };
    const shown = panels.slice(0, 2).map((w) => NAMES[w.widget] ?? "a diagram");
    cover = {
      data: webp.toString("base64"),
      mimeType: "image/webp",
      filename: `blog-${article.slug}-${crypto.createHash("sha1").update(webp).digest("hex").slice(0, 8)}`,
      alt: `${article.title}, with ${shown.length ? shown.join(" and ") : "its title"} from the article's interactive models`,
    };
    log(`cover: ${(webp.length / 1024).toFixed(0)} KB, ${shown.length} diagram(s)`);
  } catch (e) {
    notes.push(`no cover image: ${(e as Error).message}`);
  }
  log(`"${article.title}" (${wordCount(article.body_markdown)} words) → ${mode}${at ? ` at ${at}` : ""}`);

  let liveUrl = "";
  if (DRY) {
    log("dry run: nothing sent to the CMS");
  } else {
    const { status, data } = await cms<{ ok?: boolean; liveUrl?: string; adminUrl?: string; error?: string; problems?: string[]; cover?: string | null; warnings?: string[] }>("POST", "ingest", {
      article: { ...article, referenceNumber: undefined, pipelineTopics: ref, author: article.author ?? "METNMAT Research Team" },
      widgets,
      publish: { mode, at },
      notes,
      linkedin: article.linkedin_post,
      cover,
    });
    if (!data.ok) throw new Error(`CMS refused the article (${status}): ${data.error ?? ""} ${(data.problems ?? []).join("; ")}`);
    liveUrl = data.liveUrl ?? "";
    log(`CMS accepted it: ${liveUrl}${data.cover ? " (with cover)" : " (no cover)"}`);
    for (const w of data.warnings ?? []) {
      log(`CMS warning: ${w}`);
      notes.push(`CMS: ${w}`);
    }
  }

  summary([
    `## ${article.title}`,
    "",
    `- Mode: **${mode}**${at ? ` (goes live ${at.replace("T", " ").slice(0, 16)} UTC)` : ""}${DRY ? " · dry run" : ""}`,
    liveUrl ? `- Link: ${liveUrl}` : "",
    `- Words: ${wordCount(article.body_markdown)} · Topic ref: ${ref || "–"}`,
    ...notes.map((n) => `- ${n}`),
    "",
    "### LinkedIn post",
    "",
    "```",
    String(article.linkedin_post ?? ""),
    "```",
  ].filter((l) => l !== ""));
}

main().catch((e) => {
  console.error("[blog] failed:", (e as Error).message);
  process.exit(1);
});
