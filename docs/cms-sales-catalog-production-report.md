# CMS Sales + Catalog — implementation report

Covers `1a11021 → 143e820`. Read alongside `docs/cms-sales-catalog-audit.md`, which is the Phase 0
audit and explains why this report is much shorter than the brief that prompted it.

## The short version

The brief asked for a commerce administration system to be built. **Most of it already existed.**
Payload CMS generates the product list, its pagination, filtering, sorting and bulk actions;
`Products` is a 549-line tabbed editor already carrying tiered pricing, MOQ, GST, sizes, SEO and a
published-only public read gate; drafts, versions and preview are native; order status transitions,
sequential invoice numbering, quotation approval gates, RBAC and audit logging are all present and
already covered by tests; and the dashboard statistics are real `payload.count()` calls, not the
demo values the brief assumed. Rebuilding any of that would have been the wrong move and none of it
was rebuilt.

**One thing was genuinely missing and it was the important one: inventory was not managed at all.**
That is what was built.

## Architecture before

`StockLedger` was a correct append-only ledger — append-only enforced by `update: () => false` and
`delete: () => false`, with before/after quantities — **that nothing wrote to**. Verified by search
across both applications: `grep -rn "stock-ledger" apps/` returned only the collection's own
definition. `stockQty` and `reservedStock` were never written by any code; their only consumer was
the low-stock widget on the dashboard. A paid order decremented nothing, a cancellation restored
nothing, `reservedStock` was never set so "available" was never computed anywhere, and the
storefront never read stock at all.

In business terms: the shop could oversell without limit, silently, with no audit trail.

## Architecture after

| Layer | File | What it does |
|---|---|---|
| Arithmetic | `apps/dashboard/src/lib/stock-math.ts` | pure, exhaustively tested. Direction lives in the movement type, never the sign of the quantity. Neither counter may go negative; you cannot reserve stock you do not have; you cannot ship out from under a reservation. A recount is separate from a direction |
| Writes | `apps/dashboard/src/lib/stock.ts` | atomic `findOneAndUpdate` whose **filter carries the business rule** — a stock-out only matches a document that still has enough. No read-modify-write, so concurrent adjustments cannot lose one another. Ledger row and product update commit together |
| Order lifecycle | `apps/dashboard/src/hooks/order-stock.ts` | entering `paid` takes goods out; cancelling or refunding a consumed order hands them back; `paid → shipped → delivered` does **not** decrement again |
| Category safety | `apps/dashboard/src/hooks/category-guards.ts` | refuses to delete a category that still has products or sub-categories |

### Concurrency

The race is closed by construction rather than by retry. Each movement is one atomic
`findOneAndUpdate` whose filter is the rule:

```
stock-out:  { _id, $expr: { $gte: [ { $subtract: ["$stockQty", q] }, { $ifNull: ["$reservedStock", 0] } ] } }
reserve:    { _id, $expr: { $lte: [ { $add: ["$reservedStock", q] }, "$stockQty" ] } }
```

If the filter does not match, nothing is written and no ledger row is created — the caller gets a
precise reason instead of an impossible position. `$inc` treats a missing field as zero, which
matters because products created before inventory existed have no `stockQty` at all.

### Idempotency

Razorpay redelivers webhooks and staff re-save orders. The guard needs no new field: **the ledger
is itself the record** of whether stock has already been applied, so the hook looks for a movement
of the same kind already booked against the order. That is exact, survives restarts, and cannot
drift from the thing it protects.

### Failure posture

`order-stock` never throws. An order must not fail to be marked paid because inventory bookkeeping
had a problem — the payment is the fact, the stock number is the bookkeeping. A refusal is logged
at error level naming the order, product and reason, for reconciliation.

## Database changes

**None.** No migration. Every field written already existed on `products` and `stock-ledger`. This
is deliberate: the schema was already right, only the write path was absent.

## Environment variables

**None added.**

## Tests

684 total, 59 files, up from 632. 52 new across three files:

| File | Covers |
|---|---|
| `test/stock-math.test.ts` | 35 — arithmetic, negative-stock refusal, reservation limits, shipping out from under a reservation, uncounted products, recount, and every order-status pair |
| `test/stock-guards.test.ts` | 9 — that the Mongo filters actually carry the guard. A guard reduced to `{}` would pass every arithmetic test while allowing the exact oversell this exists to prevent |
| `test/category-guards.test.ts` | 8 — delete refusal, both obstacles, correct singulars |

Existing tests: all 632 still pass, none weakened or deleted.

## Deployment status

**DEPLOYED = NO.**

The push landed at `143e820` but **nothing shipped**, correctly:

- The website auto-deploy did not fire, because no `apps/website/**` file changed. Live website
  remains `da113f5`.
- **The CMS deploys only by manual dispatch.** The last CMS deploy was `24b52f1`, so the live CMS
  does not contain any of this work.

To ship it, run the *Deploy CMS to EC2* workflow by hand from the Actions tab, on `main`.

## Production verification

**Not performed, because the code is not in production.** Nothing in this report claims live
behaviour. The evidence here is: unit tests, typecheck of both apps, lint, and a successful CMS
production build with the `importMap` invariant intact at 4 `ClientUploadHandler` entries.

## Status matrix

Honest states. "Already existed" means verified by reading the code, not built in this pass.

| Area | Status | Evidence |
|---|---|---|
| Products | ALREADY EXISTED | `Products.ts` 549 lines: tabs, drafts, published-read gate, preview URL, unique auto-slug, tiered pricing, MOQ, GST, sizes, SEO |
| Product media | ALREADY EXISTED | `images[]` upload → S3 via `storage-config.ts`, instance-role auth |
| Categories | IMPROVED | delete guard added; SEO fields still absent |
| Inventory | **BUILT** | `lib/stock-math.ts`, `lib/stock.ts` — 44 tests |
| Stock ledger | **BUILT (wired)** | `hooks/order-stock.ts`; ledger had no writer before |
| Orders | ALREADY EXISTED | `Orders.ts`, `hooks/order-workflow.ts` transition legality |
| Invoices | ALREADY EXISTED | sequential FY numbering, minted on first `paid`, idempotency-guarded |
| Shipments | ALREADY EXISTED | `Shipments.ts`, `hooks/shipment-sync.ts` |
| Payments | ALREADY EXISTED | `PaymentEvents.ts`, webhook route, field-level access on Razorpay ids |
| RFQ | ALREADY EXISTED | `Enquiries.ts`, `hooks/enquiry-reference.ts` |
| RFQ uploads | ALREADY EXISTED | `EnquiryUploads.ts` |
| Quotations | ALREADY EXISTED | `Quotations.ts` + approval gates in `hooks/workflow-gates.ts` |
| Returns | ALREADY EXISTED | `ReturnRequests.ts` |
| Pricing | ALREADY EXISTED | `priceTiers[]`, `moq`, `internationalPricing`, `gstRate` |
| Authentication | ALREADY EXISTED | Payload auth, PIN login, throttle |
| Authorization | ALREADY EXISTED | 13 access functions, area-based roles, tested |
| Audit logging | ALREADY EXISTED | `hooks/audit.ts` on every sales/catalog collection |
| Security | NOT RE-REVIEWED | no new endpoint was added; the stock service is server-side only and has no HTTP surface |
| Performance | PASS (static) | counts are aggregations; slug lookup is per order line, not per list row; no new client JS, no observers, timers or animations added |
| Tests | PASS | 684 passing, 52 new |
| Deployment | **NO** | CMS is manual-dispatch; live CMS is `24b52f1` |
| Production smoke test | **NOT RUN** | code is not deployed |

## What was NOT done

Stated plainly rather than buried:

- **No integration test against MongoDB.** The arithmetic, the concurrency guard shapes and the
  transition rules are unit-tested; the actual Mongo round trip is not, because this repository has
  no test database and I did not point tests at production.
- **No E2E.** The brief's product round-trip (create → upload → publish → verify on the website) was
  not executed. It requires CMS admin credentials and would create records in the production
  catalogue.
- **No admin UI action for manual stock adjustment.** `recountStock` exists and is tested, but is
  not yet reachable from a button in the admin; today a staff member would still edit `stockQty`
  directly, which bypasses the ledger. This is the most valuable next step.
- **Reservations are not placed at checkout.** The service supports `reserved` / `released`, and
  order payment now moves stock, but nothing reserves stock while an order is pending payment.
- **Historical orders are deliberately not backfilled.** They shipped against stock nobody was
  tracking; inventing ledger rows would fabricate history.
- Category SEO fields and per-category product counts: still absent, low value.

## Rollback

Nothing is deployed, so there is nothing to roll back. If the CMS is deployed and needs reverting,
the CMS deploy workflow restores the previous release's code and config; the previous CMS release is
`24b52f1`. To revert the code itself: `git revert 143e820 3847a22`.

## Final status

```
CODE COMPLETE                    = NO   (inventory built; admin adjustment UI and checkout
                                         reservations remain)
TEST COMPLETE                    = NO   (unit only; no DB integration test, no E2E)
SECURITY COMPLETE                = N/A  (no new endpoint or HTTP surface introduced)
DEPLOYMENT COMPLETE              = NO   (CMS is manual-dispatch; not yet run)
PRODUCTION VERIFICATION COMPLETE = NO   (not deployed, so not verifiable)
PRODUCTION READY                 = NO
```
