import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTONOMOUS_ADDENDUM,
  WIDGET_IDS,
  blockers,
  brief,
  builtWidgetLibrary,
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
} from "../scripts/blog/lib";
import { createRequire } from "node:module";
import { COVER_H, COVER_W, coverWebp, renderCoverSvg, wrap } from "../scripts/blog/cover";
import { abstractFromIndex, checkReference, deepseekChat, firstSurname, parseModelJson, sourceMatches, titleOverlap } from "../scripts/blog/sources";

/**
 * The weekly article pipeline publishes without a person in the loop, so the
 * parts that decide WHAT goes out and WHEN are pinned here. No test touches the
 * network: Crossref and DeepSeek are faked.
 */
const ROOT = join(__dirname, "..");
const MP = readFileSync(join(ROOT, "docs/blog/MASTER-PROMPT.md"), "utf8");
const TODAY = join(ROOT, "docs/blog/articles/2026-10-26-ellingham-pourbaix");

describe("master prompt and topic bank", () => {
  it("parses all 52 topics in order", () => {
    const t = parseTopicBank(MP);
    expect(t).toHaveLength(52);
    expect(t.map((x) => x.n)).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
    expect(t[0]).toMatchObject({ n: 1, pillar: "extractive", archetype: "puzzle", widget: "ellingham" });
  });

  it("offers the model only the widgets the website can draw", () => {
    const lib = builtWidgetLibrary(promptBlock(MP, "widgets"));
    for (const id of WIDGET_IDS) expect(lib).toMatch(new RegExp(`^- ${id}[\\s(:]`, "m"));
    expect(lib).not.toMatch(/^- (nernst|butler-volmer-tafel|eis-nyquist|binary-phase-diagram):/m);
    const sys = systemPrompt(MP, "metallurgy", "technical-article");
    expect(sys).not.toContain("{WIDGET_LIBRARY}");
    expect(sys).not.toContain("{CATEGORIES}");
    expect(sys.endsWith(AUTONOMOUS_ADDENDUM)).toBe(true);
  });

  it("skips topics already published, including combined articles", () => {
    const t = parseTopicBank(MP);
    const used = usedTopics([{ pipelineTopics: "MI-T01 MI-T06" }, { referenceNumber: null }, { referenceNumber: "MI-T02" }]); // new field, and the old one for earlier articles
    expect([...used].sort()).toEqual([1, 2, 6]);
    expect(nextTopic(t, used)?.n).toBe(3);
    expect(nextTopic(t, used, 6)?.n).toBe(6); // an explicit override wins
    expect(topicRef(3)).toBe("MI-T03");
  });

  it("falls back to function-plot when the bank names a widget the site has not built", () => {
    const t = parseTopicBank(MP).find((x) => x.widget === "binary-phase-diagram")!;
    const b = brief({ topic: t, week: "2026-W45", recent: [{ title: "A", excerpt: "x" }], sources: [] });
    expect(b).toContain("WIDGET PREFERENCE: function-plot");
    expect(b).toContain("RECENT ARTICLES");
  });
});

describe("publish schedule", () => {
  it("is the next Thursday 10:00 IST (04:30 UTC), strictly in the future", () => {
    expect(nextThursdayIst(new Date("2026-10-26T09:00:00Z")).toISOString()).toBe("2026-10-29T04:30:00.000Z");
    expect(nextThursdayIst(new Date("2026-10-29T04:29:00Z")).toISOString()).toBe("2026-10-29T04:30:00.000Z");
    expect(nextThursdayIst(new Date("2026-10-29T05:00:00Z")).toISOString()).toBe("2026-11-05T04:30:00.000Z");
  });
});

describe("article checks", () => {
  const base: Article = {
    title: "T",
    slug: "Fire & Water: Two Maps!",
    excerpt: "E",
    seoTitle: "A".repeat(80),
    body_markdown: "Para.\n\n[EDITOR: real METNMAT story]\n\n{{figure:f1}}\n\n{{widget:main}}\n",
    widget: { type: "function-plot", config: { nope: 1 } },
  };

  it("removes editor notes and figures, clips SEO fields and slugifies", () => {
    const a = normaliseArticle(base);
    expect(a.body_markdown).not.toMatch(/EDITOR|figure/);
    expect(a.slug).toBe("fire-water-two-maps");
    expect(a.seoTitle!.length).toBeLessThanOrEqual(60);
  });

  it("cuts a long subtitle at a sentence end, not mid-sentence", () => {
    const sub =
      "Ellingham diagrams explain why charcoal smelts iron but not aluminium. Pourbaix diagrams explain why the same iron rusts in a puddle but not in concrete. Both are drawn from one quantity.";
    const a = normaliseArticle({ ...base, subtitle: sub });
    expect(a.subtitle).toBe(
      "Ellingham diagrams explain why charcoal smelts iron but not aluminium. Pourbaix diagrams explain why the same iron rusts in a puddle but not in concrete.",
    );
    // no sentence end in reach: falls back to a word boundary
    expect(normaliseArticle({ ...base, subtitle: "word ".repeat(60) }).subtitle!.length).toBeLessThanOrEqual(160);
  });

  it("holds back a short article or one whose model will not draw", () => {
    const b = blockers(normaliseArticle(base));
    expect(b.join(" ")).toMatch(/words/);
    expect(b.join(" ")).toMatch(/widget config invalid/);
  });

  it("passes today's hand-checked Ellingham + Pourbaix article", () => {
    const meta = JSON.parse(readFileSync(join(TODAY, "meta.json"), "utf8"));
    const widgets = JSON.parse(readFileSync(join(TODAY, "widgets.json"), "utf8"));
    const body = readFileSync(join(TODAY, "article.md"), "utf8");
    for (const w of Object.values(widgets) as { widget: string; config: unknown }[]) expect(parseWidget(w.widget, w.config).ok).toBe(true);
    const a = normaliseArticle({ ...meta, body_markdown: body, widget: { type: "ellingham", config: widgets.ellingham.config } });
    expect(blockers(a)).toEqual([]);
    expect(wordCount(body)).toBeGreaterThan(2500);
    expect(meta.pipelineTopics).toBe("MI-T01 MI-T06");
    expect(meta.referenceNumber).toBeUndefined();
    for (const id of Object.keys(widgets)) expect(body).toContain(`{{widget:${id}}}`);
  });
});

describe("facts handed to the review pass", () => {
  const widgets = JSON.parse(readFileSync(join(TODAY, "widgets.json"), "utf8"));

  it("Ellingham: crossing temperatures and gas ratios from the reviewed widget code", () => {
    const f = widgetFacts("ellingham", widgets.ellingham.config).join("\n");
    expect(f).toMatch(/2C \+ O₂ → 2CO crosses FeO at 1023 K \(750 °C\)/);
    expect(f).toMatch(/2C \+ O₂ → 2CO crosses Al₂O₃ at 2327 K/);
    expect(f).toMatch(/At 900 °C, reducing FeO needs pH₂\/pH₂O ≥ 2\.4\d/);
  });

  it("Pourbaix: the sequence of stable species up the potential axis", () => {
    const f = widgetFacts("pourbaix", widgets.pourbaix.config).join("\n");
    expect(f).toMatch(/At pH 7 .*Fe → Fe²⁺ from -0\.6[12] V → Fe₂O₃ from -0\.1[56] V/);
    expect(f).toMatch(/At pH 0 .*Fe³⁺ from 0\.7[67] V/);
  });

  it("reports an invalid config instead of inventing facts", () => {
    expect(widgetFacts("pourbaix", { element: "Fe" })[0]).toMatch(/invalid/);
  });
});

describe("sources and references", () => {
  it("rebuilds an OpenAlex abstract and compares titles", () => {
    expect(abstractFromIndex({ world: [1], hello: [0] })).toBe("hello world");
    expect(titleOverlap("A Practical Beginner's Guide to Cyclic Voltammetry", "A practical beginner’s guide to cyclic voltammetry")).toBe(1);
  });

  const fakeFetch = (routes: Record<string, { status: number; body: unknown }>) =>
    (async (url: string) => {
      const hit = Object.entries(routes).find(([k]) => String(url).includes(k));
      const r = hit?.[1] ?? { status: 404, body: {} };
      return new Response(JSON.stringify(r.body), { status: r.status });
    }) as unknown as typeof fetch;

  it("keeps a DOI that resolves to the cited work and strips one that does not", async () => {
    const f = fakeFetch({
      "works/10.1%2Fgood": { status: 200, body: { message: { title: ["Theory of cyclic voltammetry"] } } },
      "works/10.1%2Fother": { status: 200, body: { message: { title: ["Something unrelated entirely"] } } },
    });
    expect((await checkReference({ title: "Theory of cyclic voltammetry", doi: "10.1/good" }, f)).verdict).toBe("doi-ok");
    expect((await checkReference({ title: "Theory of cyclic voltammetry", doi: "10.1/other" }, f)).verdict).toBe("doi-wrong");
    expect((await checkReference({ title: "Theory of cyclic voltammetry", doi: "10.1/missing" }, f)).verdict).toBe("doi-wrong");
  });

  it("adds a DOI only when Crossref finds a near-exact title", async () => {
    const f = fakeFetch({ "query.bibliographic": { status: 200, body: { message: { items: [{ title: ["Reducibility of oxides and sulphides in metallurgical processes"], DOI: "10.9/x" }] } } } });
    expect(await checkReference({ title: "Reducibility of oxides and sulphides in metallurgical processes" }, f)).toEqual({ verdict: "doi-missing-found", doi: "10.9/x" });
    expect((await checkReference({ title: "A textbook nobody indexed" }, f)).verdict).toBe("unverified");
  });

  it("does not give a textbook the DOI of someone's review of it (the dry-run bug)", async () => {
    const review = { title: ["Electrochemical Methods: Fundamentals and Applications"], DOI: "10.1023/a:1021637209564", author: [{ family: "Zoski" }], issued: { "date-parts": [[2002]] } };
    const f = fakeFetch({
      "query.bibliographic": { status: 200, body: { message: { items: [review] } } },
      "works/10.1023": { status: 200, body: { message: review } },
    });
    const book = { title: "Electrochemical Methods: Fundamentals and Applications, 2nd ed.", authors: "Allen J. Bard, Larry R. Faulkner", year: 2001 };
    expect((await checkReference(book, f)).verdict).toBe("unverified");
    expect((await checkReference({ ...book, doi: "10.1023/a:1021637209564" }, f)).verdict).toBe("doi-wrong");
  });

  it("rejects the review even when Crossref lists it with no authors (the GitHub dry-run case)", async () => {
    // The real record behind 10.1023/a:1021637209564: a 2-page review, no authors, filed in a journal.
    const review = {
      title: ["Allen J. Bard and Larry R. Faulkner, Electrochemical Methods: Fundamentals and Applications, New York: Wiley, 2001, 2nd ed."],
      DOI: "10.1023/a:1021637209564",
      author: [],
      issued: { "date-parts": [[2002]] },
      "container-title": ["Russian Journal of Electrochemistry"],
    };
    const f = fakeFetch({ "works/10.1023": { status: 200, body: { message: review } } });
    const cited = { title: "Electrochemical Methods: Fundamentals and Applications", authors: "Bard, A. J.; Faulkner, L. R.", year: 2001, source: "Wiley", doi: "10.1023/a:1021637209564" };
    expect((await checkReference(cited, f)).verdict).toBe("doi-wrong");
  });

  it("matches abbreviated journal names and refuses unrelated ones", () => {
    expect(sourceMatches("J. Chem. Educ.", "Journal of Chemical Education")).toBe(true);
    expect(sourceMatches("Phys. Rev. B", "Physical Review B")).toBe(true);
    expect(sourceMatches("Analytical Chemistry", "Analytical Chemistry")).toBe(true);
    expect(sourceMatches("Wiley", "Russian Journal of Electrochemistry")).toBe(false);
    expect(sourceMatches("CRC Press", "Journal of Physical Chemistry")).toBe(false);
  });

  it("reads the first author's surname in the usual citation styles", () => {
    expect(firstSurname("A. J. Bard, L. R. Faulkner")).toBe("bard");
    expect(firstSurname("Allen J. Bard and Larry R. Faulkner")).toBe("bard");
    expect(firstSurname("H. J. T. Ellingham")).toBe("ellingham");
    expect(firstSurname("N. Elgrishi, K.J. Rountree")).toBe("elgrishi");
  });
});

describe("DeepSeek client", () => {
  it("assembles a streamed answer and its usage, ignoring the thinking stream", async () => {
    const sse = [
      { choices: [{ delta: { reasoning_content: "thinking…" } }] },
      { choices: [{ delta: { content: '{"a":' } }] },
      { choices: [{ delta: { content: "1}" }, finish_reason: "stop" }] },
      { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } },
    ]
      .map((c) => `data: ${JSON.stringify(c)}\n\n`)
      .join("") + "data: [DONE]\n\n";
    let sent: { body?: string; headers?: Record<string, string> } = {};
    const f = (async (_url: string, init: { body?: string; headers?: Record<string, string> }) => {
      sent = init;
      return new Response(sse, { status: 200 });
    }) as unknown as typeof fetch;
    const r = await deepseekChat({ key: "k", model: "deepseek-v4-pro", messages: [{ role: "user", content: "x" }], json: true, effort: "low" }, f);
    expect(parseModelJson<{ a: number }>(r.content)).toEqual({ a: 1 });
    expect(r.finish).toBe("stop");
    expect(r.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });
    const body = JSON.parse(sent.body!);
    expect(body).toMatchObject({ model: "deepseek-v4-pro", stream: true, reasoning_effort: "low", response_format: { type: "json_object" } });
    expect(sent.headers!.Authorization).toBe("Bearer k");
  });

  it("reads a fenced JSON answer", () => {
    expect(parseModelJson<{ b: number }>("```json\n{\"b\":2}\n```")).toEqual({ b: 2 });
  });
});

describe("cover image", () => {
  const widgets = JSON.parse(readFileSync(join(TODAY, "widgets.json"), "utf8"));

  it("draws the article's own diagrams beside an escaped title", () => {
    const svg = renderCoverSvg({ title: "Rust <script>alert(1)</script> & steel", kicker: "Metallurgy", widgets: Object.values(widgets) as { widget: string; config: unknown }[] });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).toContain("METNMAT INSIGHTS");
    expect(svg).toContain("Ellingham diagram");
    expect(svg).toContain("Pourbaix diagram, Fe");
    expect(svg.match(/<polygon /g)?.length).toBe(6); // one field per iron species
    expect(svg).toContain("Interactive models inside");
  });

  it("leaves out a model whose config does not validate instead of drawing nonsense", () => {
    const svg = renderCoverSvg({ title: "T", widgets: [{ widget: "pourbaix", config: { element: "Fe" } }] });
    expect(svg).not.toContain("Pourbaix diagram");
    expect(svg).not.toContain("Interactive model");
  });

  it("wraps a long title and marks a cut with an ellipsis", () => {
    expect(wrap("one two three four five six", 9, 2)).toEqual(["one two", "three…"]);
    expect(wrap("short title", 20, 3)).toEqual(["short title"]);
  });

  it("rasterises to a 1600×900 WebP the media library accepts", async () => {
    const webp = await coverWebp(renderCoverSvg({ title: "T", widgets: [{ widget: "ellingham", config: widgets.ellingham.config }] }));
    expect(webp.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(webp.subarray(8, 12).toString("latin1")).toBe("WEBP");
    const sharp = createRequire(join(ROOT, "apps/dashboard/package.json"))("sharp") as typeof import("sharp");
    const meta = await sharp(webp).metadata();
    expect([meta.width, meta.height]).toEqual([COVER_W, COVER_H]);
  });
});

describe("cover title fits its column", () => {
  it("never lets a title line run under the diagram panel, in the widest font the runner uses", () => {
    for (const title of [
      "Fire and Water: The Two Maps That Decide Where a Metal Survives",
      "How to Read a Cyclic Voltammogram: Peaks, Scan Rate, and the 57 mV Gap",
      "Hall–Petch: smaller grains, stronger metal, until it isn't",
    ]) {
      const svg = renderCoverSvg({ title, widgets: [] });
      const lines = [...svg.matchAll(/<text x="80" y="\d+" font-size="(\d+)" font-weight="700" fill="#16181d">([^<]*)<\/text>/g)];
      expect(lines.length).toBeGreaterThan(1);
      for (const [, size, text] of lines) {
        const chars = text!.replace(/&[a-z]+;/g, "x").length;
        // DejaVu Sans Bold averages about 0.66 em per character; the panel starts at x = 760.
        expect(80 + chars * 0.66 * Number(size)).toBeLessThan(760);
      }
    }
  });
});
