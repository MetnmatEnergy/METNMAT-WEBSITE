# metnmat.in blog posts (July–August 2023), republished on metnmat.com

METNMAT's old Wix site, `www.metnmat.in`, carried 26 blog posts. Since the domain moved on
2026-10-27 every old `/post/<slug>` URL has answered with a 301 to the generic `/blog` page, which
tells Google the article is gone, so its rankings are dropped instead of passed on. The 15 posts
here still had real search traffic, so each is republished on `www.metnmat.com/blog/<slug>` and its
old URL gets an exact 301 to it (`apps/website/scripts/build-legacy-redirects.mjs`, `BLOG_POSTS`).

## Which posts

The metnmat.in Search Console property, Performance → Pages, last 3 months, read 2026-10-29
(impressions of `#viewer-…` fragment URLs summed into their post). Every post with at least 100
impressions is here; `meta.json → republishedFrom.searchConsole3Months` records each one's numbers.

| Left out | Impressions | Why |
|---|---|---|
| `tailored-solutions-for-metallurgy-and-materials-industries-metnmat-research-and-innovation` | 109 | A 2023 services advert, not an article. Its old URL goes to `/services`. |
| 10 others | 53 or fewer each, 4 with none | Too little traffic to carry; they keep the `/post/:slug → /blog` rule. |

## Where the text came from

Wix still serves the original site when it is asked for `www.metnmat.in` directly (only the DNS
moved), so each post was read from the live Wix copy, not from an archive:

```bash
curl -s --resolve www.metnmat.in:443:185.230.63.171 https://www.metnmat.in/post/<slug>
```

The Internet Archive holds 20 of the 26 but none of
`introduction-to-metallurgy-…`, `modern-technologies-…`, `key-elements-…` or
`defect-and-microstructure-…`, which is why the live copy was used. Where both exist they agree:
the live text of `the-basics-of-metals-…` and `exploring-the-world-of-high-temperature-alloys-…`
matches the archive's 2023-09-30 captures word for word, apart from the button labels.

## What was changed

The words of each article are as published in 2023. Only formatting was touched:

- Links were removed and their text kept. Nearly all pointed at the metnmat.in home page as
  keyword links; one pointed at an unrelated third-party site (`autowhat.app`).
- The hand-made "Table of Contents" lists (in-page links) were removed, because the blog builds its
  own contents list from the headings.
- Wix call-to-action buttons ("Get More About Us" and similar) and the images were not carried
  over. The cover is drawn from the title by the pipeline, as for every other post.
- Pull-quote attributions were written one way: `- Metnmat Research and Innovation`.

Titles, slugs, excerpts and SEO fields are new, written to the CMS limits (title ≤ 70, SEO title ≤ 60,
description ≤ 155 characters) from each post's original headline and description, which
`meta.json → republishedFrom` keeps. The byline is the original Wix author.

## How they were filed

Each folder is a prepared article for the weekly pipeline (`docs/blog/PIPELINE.md`): *Weekly blog
article* → Run workflow → `article` = the folder, `mode` = `draft`. The pipeline holds them as
drafts anyway, because they have no interactive model. They are published from the CMS, with
**Published date** set to the original 2023 date in `republishedFrom.datePublished`.
