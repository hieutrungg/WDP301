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
