# Loading the product catalogue

How product rows and photographs get into the live shop.

> Run this **from a laptop, not on the server.** Image processing happens
> wherever the upload is handled, and the instance runs four applications with
> roughly 400 MB of headroom. Locally, six `sharp` encodes per product cost
> nothing that matters and only finished objects cross the network.

---

## The image specification

Upload the **original photograph, untouched** — any orientation, any ratio. The
only gate `enforceProductImageSpec` still applies is a resolution floor
(shortest side ≥ 900 px), which keeps genuine camera photos in and
messenger-app recompresses out.

Composition is handled by the CMS itself: on upload, the display-derivative
hook (`src/hooks/product-display-derivative.ts`) detects the product against
the studio background, stores the detected focal point (staff can drag-correct
it in the admin — doing so recomposes the derivative), and generates a
subject-aware **`display` size (exact 4:3, 1600 × 1200 WebP)** that the shop
grid, product gallery and cards all render. Only background is ever cropped;
nothing is stretched; the **stored original stays untouched** and is what the
lightbox serves as the complete photograph.

`scripts/normalize-product-images.ts` is no longer needed for the website —
keep it for `--amazon`, which produces the 2000 × 2000 opaque-white square
marketplaces require.

### ⚠ Settle the derivative ladder before the first bulk upload

Payload generates the five `imageSizes` **at upload time only** — `micro`,
`thumb`, `card`, `pdp`, `zoom`. Changing the ladder afterwards does not touch
existing media. Re-cutting it after 200 products are in means re-uploading all
200. Decide it now: `apps/dashboard/src/collections/Media.ts`.

---

## The three steps

### 1. Build a manifest from the photographs

```bash
pnpm --filter dashboard catalogue:manifest ./photos --out catalogue.json
```

This reads the folder, works out which files are views of the same product, and
writes a JSON file with the groupings done and the commercial fields blank.

Grouping follows the naming already used in this catalogue — a base name plus an
optional trailing index:

```
Titanium Felt Electrode.webp      ─┐
Titanium Felt Electrode 2.webp     ├─ one product, in this order
Titanium Felt Electrode 10.webp   ─┘
```

The unnumbered file is the **primary** image: the one the shop grid and Open
Graph tags use. A number inside the name is left alone — `Gas Sampling Bag 1
Litre.webp` is one product, not view 1 of "Gas Sampling Bag".

It also measures every file and reports anything off-spec, with the command to
fix it. Nothing touches the database or the network at this step.

### 2. Fill in what a photograph cannot tell you

Open `catalogue.json`. Each product needs:

| Field | Notes |
|---|---|
| `categorySlug` | must already exist in the CMS — the importer lists valid ones if it doesn't |
| `sku` | your part number |
| `price` | INR, GST-inclusive, must be above 0 |
| `shortDesc` | one line; shown on cards and used for meta description |
| `alt` | accessibility + SEO. Defaults to the product name if left blank |
| `moq`, `unit`, `mrp`, `featured`, `inStock` | prefilled with sensible defaults |

`name` and `slug` are derived from the filename — correct them here if the
derivation is wrong. Acronyms in particular come out title-cased (`pem fuel cell`
→ `Pem Fuel Cell`), so fix those by hand.

**More photographs arriving later?** Re-run step 1 with `--merge`. Everything
already filled in is kept and only new products are added.

### 3. Dry run, then import

```bash
cd apps/dashboard

# rehearse against the dev database first
pnpm catalogue:import catalogue.json --images ./photos --target=dev --dry-run
pnpm catalogue:import catalogue.json --images ./photos --target=dev

# then production
pnpm catalogue:import catalogue.json --images ./photos --target=prod --dry-run
pnpm catalogue:import catalogue.json --images ./photos --target=prod
```

The whole manifest is validated **before anything is written** — blank prices,
unknown categories, missing files, off-spec images. A catalogue import that
fails halfway leaves the shop in a state nobody designed, so the checks that can
happen without the database happen first.

It is **idempotent**: a product already carrying exactly the images the manifest
names is skipped, so an interrupted run is resumed by running it again.

Required environment for `--target=prod`:

```
MONGODB_URI          …/metnmat_cms      (NOT metnmat — that is the chatbot's)
STORAGE_PROVIDER     s3
S3_BUCKET            metnmat-media-prod
S3_REGION            ap-south-1
AWS credentials with write access to that bucket
```

### Guards

The importer refuses rather than guesses:

- **No `--target`** → refuses. There is no default.
- **`--target=prod` but the URI is a `_dev` database** → refuses. That failure is
  silent otherwise: the import reports success, the live site does not change,
  and the next hour goes into debugging a deploy that was never the problem.
- **`--target=dev` but the URI is not `_dev`** → refuses.
- **URI points at `metnmat`** → refuses by name. That is the chatbot's database;
  writing Payload collections into it has happened before and left stray
  `_products_versions` behind.
- **`--target=prod` without `STORAGE_PROVIDER=s3`** → refuses. Unset it defaults
  to `gcs`, the retired provider, and uploads would fail partway through.

### Replacing rather than adding

`--retire-missing` sets any product **not** in the manifest to `_status: draft`.
It disappears from the shop and stays in the database.

Nothing is ever hard-deleted. Orders snapshot the SKU as text so purchase history
survives either way, but `StockLedger` holds a *required* relationship to the
product — deleting would orphan those rows. Drafting is reversible; deleting is
not.

---

## Known state: the media library is empty

The S3 bucket holds **zero objects**, while the CMS database carries **59 media
records** inherited from the Cloud Run deployment. Their files were never copied
— the media migration was cancelled by decision, in favour of uploading fresh.

So every one of those 59 records is dangling, and `/api/media/file/<name>`
returns 404 for all of them. Practically:

- **62 of the 68 live products have no image at all.** These degrade gracefully —
  `product-image.tsx` renders the branded placeholder when `src` is absent.
- **6 products carry references to files that do not exist.** These are *worse*
  off, because `src` is set and the browser gets a broken image rather than the
  placeholder:

  `pem-fuel-cell-hardware` · `photocatalytic-water-splitting-panel-reactors-app-400` ·
  `ewf-transparent-flow-electrolyzer-zero-gap` · `gas-sampling-bag-1-litre-with-ptfe-valve` ·
  `intelligent-peristaltic-pump-dual-channel-dc-24v` · `titanium-felt-electrode`

Importing over those six with real photographs fixes them — the importer replaces
the `images` array rather than appending to it. The remaining orphaned media
records are clutter in the admin library, not breakage, and can be cleared
afterwards.

---

## Verifying

```bash
cd apps/dashboard
pnpm exec tsx scripts/audit-product-images.ts        # per-product image health
```

Then on the live site: a product page should show the photo, the zoom viewer
should open at full resolution, and the shop grid should not shift as images
load. Content changes are live immediately — no deploy is involved.
