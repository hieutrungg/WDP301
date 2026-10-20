# Ticket price plans: collection migration and integration

Scope authorized by Hieu in chat on 2026-10-18: prepare the new collection and a runnable Atlas migration. No Atlas execution was performed by the agent. Runtime pricing integration and price-management permissions are not implemented by this migration.

## Collection

Each `ticket_price_plans` document represents a complete version of a reusable ticket price configuration. A newer price list gets a new document and version rather than changing the prices of an already-used version. The future service must enforce version immutability; a JSON Schema validator only checks document structure.

Fields: `_id`, `code`, `name`, `version`, `status` (`DRAFT`, `ACTIVE`, `RETIRED`), `currency` (`VND`), `seatTypePrices` (`STANDARD`, `VIP`, `DOUBLE_LUXURY`), optional `createdBy`/`updatedBy`, `createdAt`, `updatedAt`. All three prices are required, nonnegative safe integers in dong. Zero remains allowed like the existing money contract; it must be explicit, never a fallback for a missing price.

The fixed seat-type keys match the current Room classification. Any future seat-type extension must update the pricing validator through a reviewed migration. No branch-specific eligibility, time-window rules, promotions, automatic plan selection, or combo pricing are implied.

Unique index: `{ code: 1, version: 1 }`. Multiple versions may coexist. `ACTIVE` means selectable for a new Showtime; existing published Showtimes continue using their frozen snapshots after a plan is retired.

Example for review only (the amounts are the current development fixtures, not approved production prices):

```javascript
{
  code: "DEFAULT",
  name: "Bang gia ve mac dinh",
  version: 1,
  status: "DRAFT",
  currency: "VND",
  seatTypePrices: { STANDARD: 90000, VIP: 120000, DOUBLE_LUXURY: 180000 },
  createdAt: new Date(),
  updatedAt: new Date()
}
```

## Run against Atlas

From `server`, using the existing `MONGODB_URI` in `server/.env`:

```powershell
node src/migrations/20261018-ticket-price-plans.js --database cinema_management_dev --dry-run
node src/migrations/20261018-ticket-price-plans.js --database cinema_management_dev --apply
```

The first command is an offline preview, not an Atlas compatibility check. The second creates only the new collection, its strict validator and unique index. It does not insert a price plan, change any current prices, run a seed, backfill old Showtimes, or create API permissions. No dependencies or package scripts were added.

Reruns reuse an identical validator and equivalent index. Incompatible existing validators/indexes stop execution for review; the script never drops an index or overwrites a validator. If index creation fails after collection creation, the collection may remain and the command must be rerun after resolving the cause. Do not resolve a conflict by dropping the collection.

## Relations: proposed runtime integration, not applied by this script

| Collection | Relation / responsibility |
| --- | --- |
| `showtimes` | Add `ticketPricePlanId -> ticket_price_plans._id`. One plan version can serve many Showtimes. Since each version has its own `_id`, a second version field on Showtime is optional denormalization. This field is not added to the current Mongoose model yet. |
| `accounts` | Optional `createdBy` and `updatedBy` reference the real actor. The future authenticated service must derive these IDs and verify the actor/permissions. No account is fabricated by the migration. |
| `rooms`, `room_layout_versions` | Supply each physical seat's type through the immutable layout reader. No price or plan reference is put on a physical Seat. |
| `showtime_seats` | At publish, resolve each seat type through the selected plan and write `priceSnapshot` in the publication consistency boundary. Reach the plan via `showtimeId`; no direct plan ID is necessary on every seat row. |
| `seat_holds` | Copy server prices into the existing `priceSnapshot`; preserve an opaque quote reference identifying the plan version and Showtime. Do not reprice an existing hold. |
| `bookings` | BOOK-009 copies the hold snapshot into `seatLines`/totals and preserves `priceQuoteReference`. No direct Plan lookup or new foreign key is required. |
| `payments`, `tickets` | Consume the authoritative Booking amount and confirmed-payment workflow; no direct Plan lookup/reference is required. |
| `concessions`, `combos`, `orders` | Independent existing catalog prices and order snapshots; no relation to the ticket price plan. Mixed checkout remains a separate decision. |

MongoDB does not enforce foreign keys. The future Showtime/Pricing service must check that the selected plan exists and is selectable and that every enabled seat has a price. Publishing must not succeed with missing prices. Current Showtime publication does not yet do this.

## Owner / review / migration impact

- Pricing provider owner: must be assigned/confirmed on the team board; do not infer an individual owner from this document.
- Consumers/reviewers: Showtime owner (selection/publish), Room owner (seat types/layout port), Booking/SeatHold owner (quote and snapshots), Auth owner (management permissions), DB/integration reviewer (validator/index migration).
- Approved in this chat: separate collection and preparation of its migration. Field shape and cross-module integration are reviewable technical proposals; no shared API, permission code, or existing relationship is changed here.
- No existing documents need a mandatory backfill for collection creation. Linking old Showtimes is a separate explicit migration; existing HELD/SOLD seats and historical snapshots must be preserved.
- Price-management API/UI, plan activation/version commands, publish integration, replacing development seed pricing, and live Atlas validation remain integration work. This collection migration alone does not fix the missing-price booking UI.

## Approved adult 2D seed — 2026-10-20

Hieu explicitly selected these prices in chat, included Wednesday in the Monday–Thursday group, and chose Sweetbox pricing for the complete pair as `2 * STANDARD + 26000`. Hieu also authorized taking over the pricing/booking integration work from Ha and Dat; the external team board has not been edited by this task. These are F-Cinema's selected configuration amounts, not a verification of current CGV tariffs.

| Code, version 1 | Intended show date in Asia/Ho_Chi_Minh | STANDARD | VIP | DOUBLE_LUXURY, complete pair |
| --- | --- | ---: | ---: | ---: |
| `ADULT_2D_WEEKDAY` | Monday through Thursday, including Wednesday | 105000 | 110500 | 236000 |
| `ADULT_2D_WEEKEND` | Friday through Sunday | 125000 | 130500 | 276000 |

Both new documents have `status: ACTIVE` and `currency: VND`. The standalone seed `server/src/seeds/seed-ticket-price-plans.js` inserts these two complete versions only. It is not imported by the backend or `seed-development.js`; none of the old bootstrap/auth/development seeds is run. It requires the existing reviewed collection validator and a full unique `(code, version)` index, and never creates/replaces schema or indexes itself.

Run from `server`:

```powershell
# Offline preview; does not connect to Atlas.
node src/seeds/seed-ticket-price-plans.js --database cinema_management_dev --dry-run

# Explicitly insert the two approved versions using MONGODB_URI in server/.env.
node src/seeds/seed-ticket-price-plans.js --database cinema_management_dev --apply
```

The target database is mandatory. Existing matching versions are preserved, including IDs, names and timestamps. A conflicting price/currency/status stops execution without overwriting or reactivating an existing plan. Both existing documents are checked before the first insert. Unique-index collisions from concurrent identical runs are recovered by reading and validating the winner. The two independent plans do not require an all-or-nothing transaction: if a network/concurrent conflict interrupts inserts, one plan may remain; resolve the cause and rerun rather than deleting it.

This seed does not select plans for Showtimes, backfill `showtime_seats.priceSnapshot`, reprice active holds/bookings, or change Room layout/capacity. Automatic date selection, adult/2D applicability and mapping one DOUBLE_LUXURY choice to a complete pair still need runtime integration and owner review. No age eligibility, holiday, child/student, branch surcharge or promotion rule is introduced. The existing seat screen can still show missing prices until the publish/snapshot and UI fixes are implemented.

Changed contract: no API, enum or existing DB relationship is changed by this seed. Consumers for the next step are Showtime publish (Dat/Hieu) and SeatHold/Booking (Ha/Hieu); Room representation and historical snapshots must be reviewed before runtime integration. Unit tests use a simulated database; the dedicated MongoDB integration test is skipped unless `MONGODB_TEST_URI` is configured.

## Publish integration — 2026-10-20

Hieu requested continuing after successfully inserting the two plans. The runtime implementation now selects the approved version **1**, not an arbitrary latest version, using the Showtime's start date in `Asia/Ho_Chi_Minh`. Wednesday belongs to the weekday plan; Friday, Saturday and Sunday use the weekend plan. Changing the approved runtime version is a separate reviewed change. The adult 2D policy accepts Room format `STANDARD` or `2D` (case-insensitive); unsupported formats fail closed instead of using an invented IMAX/3D price.

The new `ticket-pricing` service exports a read contract returning the selected plan ID, currency and a copy of the complete per-seat-type prices. It reads `ticket_price_plans` without creating collections/indexes. Showtime creates a draft with optional `ticketPricePlanId`, resolves the exact Room layout through the existing Room read port, then persists all seat rows and `priceSnapshot` values in the existing seat-initialization transaction before publishing. Failed initialization prevents publication. Reinitialization with different prices is rejected; it never overwrites a historical snapshot.

For an already linked, unsold Showtime, rescheduling resolves the new date's plan. Seat prices and Showtime time/plan reference commit in the same transaction; any Booking or active SeatHold/HELD/SOLD seat prevents repricing. Expired holds can be released through the existing expiry path, but their original snapshots are retained. Hold acquisition includes the quoted price in its atomic seat-claim filter: a concurrent reprice causes the stale hold request to fail rather than replacing the new price with the old quote.

Legacy Showtimes without `ticketPricePlanId` are not automatically linked or repriced by this change. Their existing reschedule behavior and snapshots remain unchanged. The legacy Mongo validator from `docs/ref` permits the additive optional field, so no existing documents require a schema backfill merely to deploy this code. Updating old missing-price sessions needs a separately previewed/versioned migration. The seat UI missing-price fallback and Sweetbox people/capacity representation are still follow-up work; Room capacity and number of Tickets are not changed here.

Shared contract review before merge: owner/implementer Hieu (as authorized in chat), consumers/reviewers Dat (Showtime), Ha (SeatHold), Nam (Room port) and the DB integration reviewer. New persistence relationship: `showtimes.ticketPricePlanId -> ticket_price_plans._id`; no public URL, request/response shape, permission, enum or error code is added. Missing/invalid plan errors use the existing `INVALID_SHOWTIME` or `PRICE_QUOTE_FAILED` codes. Existing records are preserved and no script runs on backend startup. Runtime changes are implemented for review; cross-module approval on the team board is still pending.

Verification: unit tests cover Vietnam date boundaries, complete prices, failed publication, initialization preservation, stale quotes and transaction-session handoff. `test/ticket-pricing.mongo.test.js` additionally covers real transaction rollback and hold/reprice races on a dedicated replica set; it is skipped when `MONGODB_TEST_URI` is absent. Passing unit tests alone is not live verification of those MongoDB races.

## Legacy missing-price migration and UI — 2026-10-20

Hieu explicitly requested implementing the legacy migration and running the project. `server/src/migrations/20261020-backfill-showtime-prices.js` defaults to an **online read-only preview** against the explicit database (unlike the earlier offline collection/seed previews):

```powershell
node src/migrations/20261020-backfill-showtime-prices.js --database cinema_management_dev --dry-run
```

Apply requires individual reviewed Showtime IDs, repeat `--showtime` for multiple targets:

```powershell
node src/migrations/20261020-backfill-showtime-prices.js --database cinema_management_dev --showtime <id> --apply
```

Only upcoming `PUBLISHED` Showtimes with no plan reference, no Booking/SeatHold/Ticket history, valid active references and a complete exact-version physical-seat snapshot qualify. Existing different or invalid prices, including an explicit zero, are preserved by skipping that Showtime. Existing prices matching the plan are not rewritten; only absent prices are filled. Unsupported formats and missing/retired plans are skipped.

Every target is reinspected inside its own transaction. All its seat rows are guarded by ID/layout/state/old-price predicates and touched to conflict with concurrent seat claims; only missing prices are set. The plan reference and price fill commit together, and a changed seat/Showtime aborts the transaction. No Booking, hold, Ticket, role, permission, catalog price, Room layout or capacity is modified. There is no automatic migration or seed at application startup.

Execution record: after a read-only preview and tests, the authorized migration updated only Showtime `6ad6cc5313023d824011f9f8` in `cinema_management_dev`: 40 previously missing prices became 105000 VND, with the weekday plan reference. Readback confirmed 40 AVAILABLE seats and zero Booking/SeatHold/Ticket history; a subsequent read-only preview skipped the already linked Showtime. No old seed was run. This records that one migration execution, not a claim that real concurrency tests ran on the development DB.

The seat screen now distinguishes missing/invalid prices from an explicit configured zero, disables unpriced seats and hold actions, and labels Sweetbox amounts as a pair price. Client pricing tests cover missing values, invalid totals and charging a pair once. Checkout, Payment and Ticket completion are still separate tasks.
