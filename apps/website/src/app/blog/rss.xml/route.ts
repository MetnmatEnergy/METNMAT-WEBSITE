/**
 * RSS 2.0 feed of published blog articles (noIndex articles excluded).
 * Served from the data cache (ISR 60 s via the blog data layer) and marked
 * cacheable for feed readers.
 */
import { listBlogArticlesForFeed } from "@/frontend/lib/blog";
import { site } from "@/frontend/lib/site";

export const revalidate = 300;

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export async function GET() {
  const articles = await listBlogArticlesForFeed(50);
  const items = articles
    .map((a) => {
      const url = `${site.url}/blog/${a.slug}`;
      const pub = a.date ? new Date(a.date).toUTCString() : "";
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(a.excerpt)}</description>
      ${pub ? `<pubDate>${pub}</pubDate>` : ""}
      <category>${escapeXml(a.categoryName)}</category>
      ${a.authorLine ? `<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">${escapeXml(a.authorLine)}</dc:creator>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>METNMAT Research &amp; Engineering Insights</title>
    <link>${site.url}/blog</link>
    <description>Technical articles, research notes, engineering guides, case studies and industrial insights from METNMAT and contributing researchers.</description>
    <language>en</language>
    <atom:link href="${site.url}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
