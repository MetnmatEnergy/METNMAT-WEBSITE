# SEO Changelog

Every SEO-affecting change, newest first. Branch: `seo/technical-geo-overhaul`.

Format: what changed · why · files · verification.

---

## 2026-08-05 — Phase 1: audit only, no site changes

**Changed:** nothing that affects the live site. Audit and plan only.

**Added:**
- `docs/seo/AUDIT.md` — Phase 1 audit, root-cause diagnosis, defect register,
  execution plan, out-of-repo action list.
- `SEO_CHANGELOG.md` — this file.

**Key finding:** the premise that this is a technical-SEO failure is wrong.
`metnmat.com` is crawlable, indexable, indexed, self-canonical, with a valid
132-URL sectioned sitemap and extensive structured data. The anomaly is
explained by site age (first commit 2026-06-05; SEO layer 2026-07-31), split
authority across two live domains, and a site-wide maintenance banner that
server-renders *"Better to use metnmat.in"* on every page.

**Blocked on:** the `.IN` ↔ `.COM` decision (AUDIT.md §5). No structural change
until the owner chooses.

**Verification:** no code touched, so no build gate needed. All audit figures
measured against live production — commands in AUDIT.md §9.

**Modified files:** none. Two files added, both documentation.
