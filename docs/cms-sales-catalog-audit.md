# CMS Sales + Catalog — architecture audit

Audited 2026-09-04 against `1a11021`, by reading the code rather than assuming. The headline is
that **most of what the brief asks to be built already exists**, and one substantial thing that
looks built is not actually connected to anything.

## Current architecture

| | |
|---|---|
| CMS | Payload CMS 3.85 on MongoDB Atlas (`metnmat_cms`), admin at `admin.metnmat.com/admin` |
| Website | Next.js 15 App Router, reads the CMS over REST (`NEXT_PUBLIC_CMS_URL`); GraphQL disabled |
| Storage | Private S3 bucket `metnmat-media-prod` via `@payloadcms/storage-s3`, EC2 instance role, served through the CMS at `/api/media/file/<filename>` |
| Deploy | Website auto-deploys on push; **the CMS deploys only by manually running its workflow** |

**Payload generates the admin UI.** Every collection automatically gets a list view with
server-side pagination, search, filtering, sorting, column selection and bulk operations, plus a
create/edit form, relationship pickers, upload fields, drafts/versions, and server-enforced access
control. A large part of the brief — "build a product list with pagination and filters", "build a
product editor", "bulk publish/unpublish" — is satisfied by the framework and must not be rebuilt.

## Existing entities

All 40 collections are registered in `payload.config.ts:249-295`. Every entity the brief asks for
already exists:

**Sales** — `Orders` `Invoices` `Shipments` `PaymentEvents` `Quotations` `Enquiries`
`EnquiryUploads` `ReturnRequests` · **Catalog** — `Products` `Categories` `StockLedger` ·
**Supporting** — `Customers` `Media` `Documents` `Users` `StaffRoles` `AuditLogs` `Counters`
`IntegrationLogs` `Notifications` `Tasks` `Leads` `Clients`.

## What already exists, and is wired

### Products (`collections/Products.ts`, 549 lines)

A tabbed editor — Essentials / Media / Pricing / Specs & documents / Storefront / SEO, plus a
"Tax, stock & fulfilment" section. Fields present:

- **Identity** `name` `brand` `slug` (required, `unique`, `index`, auto-slugified at
  `beforeValidate`) `sku`
- **Content** `shortDesc` `description` `specs[]` `documents[]`
- **Media** `images[]` `videoUrl`
- **Commerce** `price` `usdPrice` `internationalPricing` (AUTO_CONVERT / FIXED_USD) `mrp`
  (compare-at) `moq` `leadTime` `priceTiers[]` (quantity-break pricing) `sizes[]`
- **Tax** `gstRate` `hsnSac` `countryOfOrigin`
- **Inventory** `stockQty` `reservedStock` `lowStockThreshold` `productType`
  (in-stock / made-to-order / quote-only / discontinued)
- **Publishing** `versions: { drafts: true }` — Payload's native draft/publish with version history
- **SEO** `seoTitle` `metaDescription` `keywords` `canonicalUrl` `ogImage` `noIndex`
- **Storefront** `inStock` `featured` `rating` `badges`
- **Governance** `priceApprovalStatus` (approved / pending) `lastReviewedAt`

Public reads are gated to published documents only (`Products.ts:20-24`) — staff on the `users`
collection bypass it so the admin list and Preview still show drafts, while customers, who are a
different auth collection, are correctly treated as public. **Preview already exists**
(`Products.ts:33-36`) and points at the live storefront URL for the product's slug.

Hooks on change: `auditAfterChange`, `revalidateWebsiteAfterChange`, `syncChatbotAfterChange`.

### Orders and the money path

`Orders.ts` carries a unique indexed `orderNumber`, a seven-state `status`, full shipping and
billing blocks, GSTIN, an `items[]` array that **snapshots** `sku` / `hsnSac` / `countryOfOrigin`
at purchase, `subtotal` / `gstAmount` / `total`, `taxTreatment`, and Razorpay identifiers whose
field-level `access.update` is restricted to accounts/internal and which are read-only in the UI.

`hooks/order-workflow.ts` already enforces **legal status transitions for everyone including the
website's internal key**, and mints an immutable sequential GST invoice number on the first
transition into `paid`, with an idempotency guard against two concurrent paid-transitions.
`hooks/workflow-gates.ts` enforces quotation approval gates (only Accounts/Admin may approve; a
quotation cannot be Sent unless approved and carrying a PDF) and task-completion gates.

### Authorization

`access/index.ts` exports a composable, area-based permission model: `canManageCatalog`,
`canManageSales`, `canManageOrders`, `canManageInventory`, `canManageAccounts`,
`canManageSettings`, `canManageSupport`, `canManageAssets`, `canManageContent`, `canReadOps`,
`canReadAudit`, `canReadStaff`, and field-level `fieldAccountsOrInternal`. Enforcement is
server-side through Payload access control, not UI hiding. Covered by `test/access.test.ts` and
`test/custom-roles.test.ts`.

### Dashboard statistics are real

The brief supposes the dashboard shows hardcoded demo values. It does not. `app/(overview)/page.tsx`
reads `.totalDocs` from real queries and `admin/BeforeDashboard.tsx` uses `payload.count()`
(`BeforeDashboard.tsx:88-89`). **There is no mock data to replace here.**

### Transactions

There is an established pattern for transactional Mongo writes — `session.withTransaction` reached
through `payload.db.connection` — used by `collections/BlogReactions.ts:50,208` and
`hooks/sync-chatbot.ts:239-241`. New transactional work should reuse it rather than invent one.

## The gap that matters

**Inventory is not managed. `StockLedger` is a well-formed table that nothing writes to.**

`collections/StockLedger.ts` is correctly designed: append-only, `update: () => false` and
`delete: () => false`, with `product`, `movementType` (7 kinds), `quantity` / `previousQuantity` /
`newQuantity`, `relatedOrder`, `relatedEnquiry`, `reason`, `createdBy` and timestamps. It is
exactly the ledger the brief specifies.

It is also entirely unwired. Verified by search across both applications:

- `grep -rn "stock-ledger" apps/` returns **nothing** outside the collection's own definition. No
  service, no endpoint, no hook creates a movement. The only way a row can exist is a human
  typing one into the Payload admin by hand.
- `stockQty` and `reservedStock` are **never written** by any code. Their only consumer is the
  low-stock widget in `admin/BeforeDashboard.tsx:180-181`.
- The checkout routes (`api/checkout/create-order`, `verify`, `webhook`) do not touch stock, so a
  paid order does not decrement anything and a cancellation or return restores nothing.
- `reservedStock` is never set, so "available stock" is not computed anywhere.
- The **website never reads stock at all** — `grep` for `stockQty` across `apps/website/src`
  returns nothing.

Consequences, in business terms: the shop can oversell without limit, and it does so silently.
Stock is a number a human types in and which drifts from reality the moment anything sells. There
is no audit trail for inventory because no movement is ever recorded.

## Smaller, real gaps

| Gap | Evidence | Severity |
|---|---|---|
| Categories have no SEO fields | `Categories.ts:19-54` — name, slug, blurb, parent, image, order, hidden, and nothing else | low |
| No guard on deleting a category that products reference | no `beforeDelete` in `Categories.ts:55-58` | medium |
| No product count shown per category | not present | low |

## Not gaps — already handled

Product list, pagination, filtering, sorting and bulk actions (Payload native) · product
create/edit (native, tabbed) · drafts and publish (`versions.drafts`) · preview
(`admin.preview`) · media upload to S3 (`storage-config.ts`) · slug uniqueness and
auto-generation · order status transition validation · invoice numbering with collision
protection · quotation approval workflow · RBAC · audit logging · dashboard statistics · cache
revalidation on save.

## Recommended plan

1. **Wire inventory** — a single authoritative stock service that atomically adjusts
   `stockQty` / `reservedStock` and appends a `StockLedger` row in the same transaction, refusing
   to drive stock negative, reusing the existing `withTransaction` pattern. Then connect it to the
   order lifecycle so a sale decrements and a cancellation or return restores.
2. Category delete guard and SEO fields.

## Risks

- **The CMS does not auto-deploy.** Any change here reaches production only when someone runs the
  *Deploy CMS to EC2* workflow by hand. A push alone ships nothing.
- Seed runs in `onInit` on every boot; it is create-if-missing, so it will not overwrite fields,
  but any new required field needs a default or existing documents fail validation.
- Backfilling stock movements for historical orders is **not** proposed: those orders shipped
  against stock that was never tracked, so inventing ledger rows would fabricate history.

## Files that should NOT be modified

`collections/StockLedger.ts` (the schema is correct as it stands) · the transition table and
invoice minting in `hooks/order-workflow.ts` (hardened and tested) · `access/index.ts` ·
`app/(payload)/admin/importMap.js` · the seed's ownership rules.
