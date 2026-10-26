# The weekly article pipeline

One METNMAT Insights article a week, written, checked and filed with no one in the loop.

| | |
|---|---|
| Runs | `.github/workflows/blog-weekly.yml`, every Monday 02:00 IST (Sunday 20:30 UTC, DeepSeek's off-peak rate), or by hand from the Actions tab |
| Code | `scripts/blog/weekly.ts` (+ `lib.ts`, `sources.ts`), tests in `test/blog-weekly.test.ts` |
| Into the CMS | `POST /api/posts/ingest` with header `x-ingest-key` (`apps/dashboard/src/lib/blog-ingest*.ts`) |
| Prompt | `docs/blog/MASTER-PROMPT.md` (system prompt, brief, widget library, 52-topic bank) |
| Cost | about $0.10–0.25 a week in DeepSeek tokens |

## What happens each week

1. **Topic.** The lowest-numbered row of the topic bank not yet used. Used topics are read from each
   post's *Reference number* (`MI-T01`, `MI-T01 MI-T06` for a combined article).
2. **Sources.** 10–15 well-cited papers with DOIs on the topic from OpenAlex go into the brief;
   the model is told to cite only those or standard textbooks.
3. **Draft.** DeepSeek V4 Pro writes the article as JSON (master prompt + an autonomous-mode
   addendum: no editor notes, no figures, built widgets only).
4. **Widget repair.** The interactive model's config must pass the website's own schema
   (`apps/website/src/frontend/lib/widgets/schemas.ts`); if not, DeepSeek Flash is asked to fix it, twice at most.
5. **References.** Every DOI is resolved at Crossref. A DOI that points at a different work is removed;
   a missing DOI is added when Crossref finds a near-exact title.
6. **Scientific review.** A second DeepSeek V4 Pro pass acts as the editor. It is given numbers computed
   by the website's own widget code from the article's config (crossing temperatures, boundary potentials,
   peak currents), so a sentence that contradicts the article's own diagram gets caught.
7. **Hard checks.** Fewer than 1,200 words, no interactive model, or a widget config that still fails:
   the article is filed as a **draft** instead, and the email says why.
8. **Into the CMS.** Created (or updated, by slug) and, by default, **scheduled for the next Thursday
   10:00 IST**. Staff get an email with the link, the pipeline's notes and the LinkedIn post text.

## Publish mode

Repository variable `BLOG_PUBLISH_MODE` (Settings → Secrets and variables → Actions → Variables):

| Value | Effect |
|---|---|
| `scheduled` (default) | Published automatically at the next Thursday 10:00 IST. Until then it is invisible, and anyone can edit or unpublish it in the CMS. |
| `immediate` | Live as soon as the run finishes. |
| `draft` | Filed for a person to publish. |

To stop a scheduled article: open the link in the email, click **Unpublish** (or edit it). The
website re-reads the CMS every 60 seconds, so a scheduled article appears within a minute of its time.

## Running it by hand

Actions → *Weekly blog article* → *Run workflow*. Inputs: a topic number, a prepared article
directory (as for `docs/blog/articles/2026-10-26-ellingham-pourbaix`, which has `article.md`,
`meta.json`, `widgets.json`), a mode, and *dry run* (generates and checks, sends nothing; the result
is kept as a workflow artifact for 90 days).

## One-time setup

```bash
bash scripts/blog/setup-secrets.sh
```

It generates `CMS_BLOG_INGEST_KEY`, adds it to the CMS secret `metnmat/cms/env` (with
`BLOG_NOTIFY_EMAIL`, copied from the website's notify list), stores it and your DeepSeek key as GitHub
secrets, and prints nothing secret. The CMS reads the key at start-up, so run *Deploy CMS (v2 host)*
afterwards. Give the blog its own DeepSeek key, so its spend is visible and it can be revoked alone.

## Security

- The ingest endpoint accepts only `CMS_BLOG_INGEST_KEY`, not the shared `INTERNAL_API_KEY`, and
  answers 503 on a CMS that has none.
- The model never ships code. Interactive models are reviewed React components; the model only
  writes their JSON config, which the website validates before drawing.
- This repository is public, so workflow logs are public: the scripts never print a secret.
