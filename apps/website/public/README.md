# Where to add images & assets

**Short answer: put files in this `public/` folder.** Anything here is served at the
site root. Example: `public/brand/logo.svg` → available at `/brand/logo.svg`.

```
apps/website/public/
├── brand/     logo, wordmark, favicon source        → e.g. /brand/logo.svg
├── images/    photos used on pages (hero, sections)  → e.g. /images/furnace.jpg
├── og/        custom social-share images (optional)  → e.g. /og/home.png
└── docs/      small PDFs (brochures, datasheets/SDS)  → e.g. /docs/catalog.pdf
```

## How to use an image in a page

Use the existing `MediaPlaceholder` component — just pass `src` (a `/public` path):

```tsx
// before (placeholder)
<MediaPlaceholder label="Furnace" />
// after (real, optimized image)
<MediaPlaceholder src="/images/furnace.jpg" alt="1200°C muffle furnace" />
```

It renders an optimized `next/image` automatically. You can also use `next/image`
directly anywhere:

```tsx
import Image from "next/image";
<Image src="/images/lab.jpg" alt="Lab" width={800} height={600} />
```

## Three places assets can live (pick by use-case)

| Use-case | Where | Why |
| --- | --- | --- |
| Logo, favicon, small site images, a few PDFs | **`public/`** (here) | Simple, served at `/…`, version-controlled |
| Image bundled with one component, want blur/optimization | **import in `src/`** (`import hero from "./hero.jpg"`) | Build-time optimization + hashing |
| Product photos, datasheets/SDS, user uploads, CMS media (bulk / production) | **Cloudflare R2 or AWS S3** | Scales, keeps the repo small. Add the host to `remotePatterns` in `next.config.mjs`, then use the full URL with `next/image`. |

## Branding to replace
- **Favicon:** `src/app/icon.svg` (currently the red "M" mark). Replace with the real mark.
- **Logo in the header:** `src/frontend/components/layout/logo.tsx` (swap the `M` block for `<Image src="/brand/logo.svg" … />`).
- **Social share image:** generated dynamically in `src/app/opengraph-image.tsx`. To use a fixed image instead, drop `public/og/og-default.png` (1200×630) and reference it in the page metadata.

> Keep individual files small (compress images, prefer SVG for logos/icons, WebP/AVIF
> for photos). Large/many files belong in R2/S3, not the repo.
