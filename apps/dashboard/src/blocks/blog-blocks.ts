import type { Block } from "payload";

/**
 * Lexical blocks for blog article bodies (Posts.body).
 *
 * The website renders each one by slug in
 * apps/website/src/frontend/components/blog/blog-blocks.tsx:
 *  - equation / inlineEquation: LaTeX typeset by KaTeX on the website's server.
 *  - interactive: one of the website's reviewed widget components, driven by
 *    a JSON config. The config is DATA (written by the weekly article
 *    generator and checked by an editor); the website validates it against
 *    the widget's schema and shows "Interactive model unavailable", with the
 *    reasons, instead of a wrong plot.
 *
 * Adding a widget is a website pull request first (component + schema), then
 * its id here. test/blog-widget-registry.test.ts fails when the two lists
 * disagree. These live outside src/collections/ because every file there is
 * treated as a collection by the admin-sidebar guardrail test.
 */

export const BLOG_WIDGETS = [
  { value: "ellingham", label: "Ellingham diagram" },
  { value: "cyclic-voltammetry", label: "Cyclic voltammogram (simulated)" },
  { value: "function-plot", label: "Function plot (sliders + formula)" },
] as const;

const LATEX_EXAMPLE = "e.g. \\Delta G^\\circ = \\Delta H^\\circ - T\\,\\Delta S^\\circ";

export const EquationBlock: Block = {
  slug: "equation",
  labels: { singular: "Equation", plural: "Equations" },
  fields: [
    {
      name: "latex",
      type: "textarea",
      required: true,
      maxLength: 2000,
      admin: {
        description: `Display equation, centred on its own line. LaTeX without the $$ delimiters, ${LATEX_EXAMPLE}. For a formula inside a sentence use "Inline equation" instead.`,
      },
    },
  ],
};

export const InlineEquationBlock: Block = {
  slug: "inlineEquation",
  labels: { singular: "Inline equation", plural: "Inline equations" },
  fields: [
    {
      name: "latex",
      type: "text",
      required: true,
      maxLength: 500,
      admin: { description: `Equation inside a sentence. LaTeX without the $ delimiters, e.g. E = E^\\circ - \\frac{RT}{nF}\\ln Q.` },
    },
  ],
};

export const InteractiveBlock: Block = {
  slug: "interactive",
  labels: { singular: "Interactive model", plural: "Interactive models" },
  fields: [
    {
      name: "widget",
      type: "select",
      required: true,
      options: BLOG_WIDGETS.map((w) => ({ ...w })),
      admin: { description: "Which reviewed model to show. Each one reads the config below." },
    },
    { name: "title", type: "text", maxLength: 120, admin: { description: "Short; says what the reader controls." } },
    {
      name: "config",
      type: "json",
      required: true,
      validate: (value: unknown) =>
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? true
          : "The config must be a JSON object, e.g. { \"temperatureRangeC\": [0, 2000], … }.",
      admin: {
        description:
          "The model's settings as JSON, in the shape the widget library defines (docs/blog/MASTER-PROMPT.md). Preview the article to check it: a config that does not fit shows \"Interactive model unavailable\" and lists why.",
      },
    },
    { name: "caption", type: "textarea", maxLength: 400, admin: { description: "One sentence shown under the model." } },
  ],
};
