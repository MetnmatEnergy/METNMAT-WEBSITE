import { describe, it, expect } from "vitest";
import {
  slugify,
  lexicalToText,
  readingTimeFromLexical,
  validateHttpUrl,
  escapeHtml,
  plainTextToLexical,
  makeSubmissionReference,
} from "../apps/dashboard/src/lib/blog";

const lexical = (texts: string[]) => ({
  root: {
    children: texts.map((t) => ({
      type: "paragraph",
      children: [{ type: "text", text: t }],
    })),
  },
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Fuel-Cell MEAs: 2026 Review")).toBe("fuel-cell-meas-2026-review");
  });
  it("strips diacritics and symbols (subscripts normalise to digits)", () => {
    expect(slugify("Électrolyse & H₂ (PEM) — 100% clean!")).toBe("electrolyse-h2-pem-100-clean");
  });
  it("trims leading/trailing hyphens and caps length", () => {
    expect(slugify("---Hello World---")).toBe("hello-world");
    expect(slugify("a".repeat(300)).length).toBeLessThanOrEqual(120);
  });
  it("handles empty input", () => {
    expect(slugify("")).toBe("");
  });
});

describe("lexicalToText / readingTimeFromLexical", () => {
  it("extracts nested text", () => {
    expect(lexicalToText(lexical(["Hello", "world"]))).toBe("Hello world");
  });
  it("returns empty for empty/invalid docs", () => {
    expect(lexicalToText(null)).toBe("");
    expect(readingTimeFromLexical({})).toBe("");
  });
  it("computes minutes at 200 wpm with a 1-minute floor", () => {
    expect(readingTimeFromLexical(lexical(["word ".repeat(50)]))).toBe("1 min read");
    expect(readingTimeFromLexical(lexical(["word ".repeat(1000)]))).toBe("5 min read");
  });
});

describe("validateHttpUrl", () => {
  it("accepts empty and http(s) URLs", () => {
    expect(validateHttpUrl("")).toBe(true);
    expect(validateHttpUrl(undefined)).toBe(true);
    expect(validateHttpUrl("https://orcid.org/0000-0001-2345-6789")).toBe(true);
    expect(validateHttpUrl("http://example.com")).toBe(true);
  });
  it("rejects script/data/other schemes and junk", () => {
    expect(validateHttpUrl("javascript:alert(1)")).not.toBe(true);
    expect(validateHttpUrl("data:text/html,<script>")).not.toBe(true);
    expect(validateHttpUrl("not a url")).not.toBe(true);
  });
});

describe("escapeHtml", () => {
  it("escapes all dangerous characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
    );
  });
});

describe("plainTextToLexical", () => {
  it("splits blank-line blocks into paragraphs", () => {
    const doc = plainTextToLexical("Para one.\n\nPara two line 1\nline 2") as {
      root: { children: { type: string; children: { type: string; text?: string }[] }[] };
    };
    expect(doc.root.children).toHaveLength(2);
    expect(doc.root.children[0].children[0].text).toBe("Para one.");
    // Second paragraph keeps its single newline as a linebreak node.
    expect(doc.root.children[1].children.map((c) => c.type)).toEqual(["text", "linebreak", "text"]);
  });
  it("never produces an empty root", () => {
    const doc = plainTextToLexical("") as { root: { children: unknown[] } };
    expect(doc.root.children.length).toBeGreaterThan(0);
  });
});

describe("makeSubmissionReference", () => {
  it("matches BPR-<year>-<6 chars> and avoids ambiguous characters", () => {
    const ref = makeSubmissionReference(2026);
    expect(ref).toMatch(/^BPR-2026-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  });
  it("is deterministic for a fixed random source", () => {
    expect(makeSubmissionReference(2026, () => 0)).toBe("BPR-2026-222222");
  });
});
