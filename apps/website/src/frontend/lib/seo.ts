import type { Metadata } from "next";
import { site } from "@/frontend/lib/site";

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
