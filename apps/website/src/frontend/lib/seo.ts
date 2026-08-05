import type { Metadata } from "next";
import { site } from "@/frontend/lib/site";

/** Google renders roughly 155-160 characters of a description before truncating. */
const META_DESCRIPTION_MAX = 155;
/** Keep the derived spec prefix from crowding out the prose that follows it. */
const SPEC_PREFIX_MAX = 80;

/** Cut at a word boundary and append an ellipsis, never mid-word. */
function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/**
 * Meta description for a product page.
 *
 * Every product in the catalogue ships with `metaDescription` unset, so all 68
 * fell back to `shortDesc` — which is written per product FAMILY, not per SKU.
 * The result was 4 descriptions repeated byte-identically across 11 URLs
 * (three Ag/AgCl pages, three gold-disk, three Hg/HgO, two platinum-wire), and
 * 59 of 68 descriptions running past Google's ~155-character display limit
 * (median 193, longest 314).
 *
 * The SKUs are genuinely different — body material, tube diameter, effective
 * length, junction core, filling solution all vary — and every one of those
 * values is already in the product's own `specs`. So the description leads with
 * the product's own distinguishing specs and follows with the family prose.
 * Nothing is invented: every word traces to a real CMS field.
 *
 * A CMS `metaDescription` always wins and is returned untouched — an editor's
 * explicit choice is never second-guessed, and it stays the escape hatch for
 * any product this derivation reads poorly for.
 */
export function productMetaDescription(product: {
  metaDescription?: string;
  shortDesc?: string;
  specs?: { label?: string; value?: string }[];
}): string {
  const override = product.metaDescription?.trim();
  if (override) return override;

  const body = (product.shortDesc ?? "").trim();

  // Lead with the specs that actually distinguish this SKU from its siblings.
  //
  // Taking the first three in CMS order was not enough: sibling SKUs share
  // their opening specs and differ further down. The platinum-wire pair is
  // identical for three rows and splits at `body material` (PEEK vs PTFE); the
  // Hg/HgO pair is identical for five and splits at `Body Material` (Glass vs
  // PTFE). So specs are ranked before slicing — material first, then
  // dimensions, then CMS order — which is the same reasoning legacy-redirects
  // encodes: body material and form factor are not decoration on an electrode,
  // they decide whether the probe fits the customer's cell.
  const rank = (label: string) =>
    /material|body/i.test(label) ? 0 : /diameter|length|size|dimension|thickness/i.test(label) ? 1 : 2;

  const candidates = (product.specs ?? [])
    .map((spec, order) => ({ label: spec.label?.trim(), value: spec.value?.trim(), order }))
    .filter((s): s is { label: string; value: string; order: number } => Boolean(s.label && s.value))
    // Stable within a tier, so CMS order still decides between equals.
    .sort((a, b) => rank(a.label) - rank(b.label) || a.order - b.order);

  const parts: string[] = [];
  const seen = new Set<string>();
  for (const { label, value } of candidates) {
    // Some products carry the same spec twice under punctuation variants —
    // "Body / Material" and "Body Material" both reading PEEK — which rendered
    // as "Body / Material: PEEK, Body Material: PEEK". Dedupe on the label
    // stripped to alphanumerics. Deliberately NOT on the value: "body diameter"
    // and "tube diameter" can legitimately both be 6 mm and both matter.
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);

    const part = `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${value}`;
    const next = [...parts, part].join(", ");
    if (next.length > SPEC_PREFIX_MAX) break;
    parts.push(part);
    if (parts.length === 3) break;
  }

  const prefix = parts.join(", ");
  if (!prefix) return truncate(body, META_DESCRIPTION_MAX);
  if (!body) return truncate(prefix, META_DESCRIPTION_MAX);
  return truncate(`${prefix}. ${body}`, META_DESCRIPTION_MAX);
}

/**
 * Per-page metadata helper.
 *
 * Sets a correct SELF-canonical (resolved against `metadataBase` in
 * app/layout.tsx) plus matching Open Graph fields, so every route advertises its
 * own URL and title instead of silently inheriting the root layout's canonical —
 * Next.js shallow-merges metadata down the tree, so a canonical set only at the
 * root would otherwise leak onto every child page.
 *
 * The file-based OG image (app/opengraph-image.tsx) applies automatically UNLESS
 * `image` is passed — pass a real cover (product/project/blog) so social shares
 * of that page show the page's own image instead of the generic card.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  image,
  imageAlt,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
}): Metadata {
  const images = image ? [{ url: image, alt: imageAlt ?? title }] : undefined;
  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: site.legalName,
      title: `${title} · ${site.name}`,
      description,
      url: path,
      ...(images ? { images } : {}),
    },
    ...(image ? { twitter: { card: "summary_large_image", title: `${title} · ${site.name}`, description, images: [image] } } : {}),
  };
}
