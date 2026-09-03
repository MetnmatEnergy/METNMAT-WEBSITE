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

Composition is handled by the CMS itself. On upload, the display-derivative
hook (`src/hooks/product-display-derivative.ts`) runs the photograph through
`src/lib/product-image-analysis.ts` and generates a subject-aware **`display`
size (exact 4:3, 1600 × 1200 WebP)** that the shop grid, product gallery and
cards all render. The **stored original stays untouched** and is what the
lightbox serves as the complete photograph.

    upload → straighten → find the background → find the product
           → settle the boundary → reframe to 4:3 inside the photograph
           → display derivative → product page

- **Straighten.** A magnitude-weighted histogram of gradient orientations
  finds the camera tilt the scene's near-axis structure shares. Only a slight,
  coherent tilt (0.4°–8°) is corrected — a deliberate three-quarter angle is
  photography, not error, and is left exactly as shot.
- **Find the background.** The border is sampled per side in thirds and the
  samples clustered, so a split scene (grey curtain over a white table) is
  understood as two backgrounds rather than averaged into one. A cluster needs
  two supporting segments, so a product crossing one border edge cannot
  register its own colour as background. Tolerance comes from the *median*
  absolute deviation, never mean + kσ — see the warning below.
- **Find the product.** Foreground pixels group into connected components;
  the strongest central one is the product. Nearby pieces (probes, ferrules,
  tubing) join by proximity, and distant-but-substantial ones join by mass, so
  a full rig of pumps and reservoirs stays whole. Contrast depth gates both,
  which is what keeps a lit patch of backdrop from qualifying as product.
- **Settle the boundary.** The masks above are wrong in both directions on a
  real studio backdrop — a curtain fold and the product's own cast shadow clear
  the colour tolerance, while a pale probe on pale paper barely does — so the
  box is not trusted to them. Each pixel's contrast depth, saturated so a dark
  steel pump head and a pale PTFE cell weigh the same, is averaged along every
  row and column. The edges settle where that profile has only a token share of
  the subject's energy outside them, then walk back out while an adjacent line
  still carries material. Integrating rather than thresholding is what lets a
  white housing with a near-zero-contrast middle stay whole. **A looser frame
  always beats a clipped product.**
- **Reframe, inside the photograph.** The 4:3 window is sized so the subject's
  binding dimension fills **84 %** of the canvas along that axis, and centred on
  the product (box centre pulled toward its mass, so a cell trailing a metre of
  tubing still sits centred on its body). It is then held to what the photograph
  can actually supply — the largest 4:3 rectangle inside it — and slid back in
  if it overhangs. Where even that cannot hold the whole product (a tall product
  shot in portrait), the frame is taken from the product instead of the ratio —
  cropped to the product plus the same margin, grown toward 4:3 as far as the
  photograph allows — and the canvas beside it is left clear, which the shop
  renders as the card's own background. Note what this is *not*: showing the
  whole photograph. That keeps every inch of empty backdrop above and below the
  product, so the fit is bound by the emptiness and the product lands at a third
  of the frame while a landscape shot of the same pump fills it — the two then
  sit side by side in the grid looking like different products.
- **Nothing is synthesised.** Earlier versions continued the backdrop into
  whatever the photograph could not fill — stretched, mirrored, smoothed,
  washed toward the scene colour. Every one of them left something on the flank:
  a smear, the backdrop board's edge printed twice, a tonal band. The rule now
  is that every pixel of the crop is a piece of the photograph. Only background
  is ever cropped; nothing is stretched or distorted; upscaling is capped at ×2.

Staff can drag the focal point in the admin to overrule the automatic
composition; doing so recomposes the derivative around their choice.

### Re-running the pipeline on photographs already uploaded

Tuning the analysis does not touch existing derivatives. To re-run it over a
product that is already in the CMS — originals untouched, only the `display`
derivative and the auto focal point refreshed, through the same hook that runs
on upload:

```bash
npx tsx scripts/recompose-display.ts --target=dev --slug=<product-slug>
```

`--media=<id>` recomposes a single asset. Note that a recompose re-seeds the
focal point from fresh detection, so a point staff dragged by hand is replaced;
re-drag it afterwards if it mattered. On prod the running CMS must be reachable
at `CMS_URL`, since the hook re-reads stored originals through it.

### ⚠ Never widen the background tolerance to "be safe"

It is the opposite of safe, and this has already reached the live gallery once.
A shaded wall or a curtain fold drags the tail of the border's colour
distribution; `mean + kσ` balloons; the tolerance grows until a pale product —
cream PEEK, beige ferrules — falls *inside* it and is classified as background.
The visible symptom is a gallery image with the top of the product sliced off,
which reads like a cropping bug and is a detection bug. `BG_THRESHOLD_CEILING`
is 38 because a pale product on a white table is only ~40 apart in RGB; wider
than that stops separating them at all. `test/product-image-analysis.test.ts`
reproduces the scene and fails on the old estimator.

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
