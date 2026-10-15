# Seat Hold Contract and Transaction Plan

## 1. Document status

| Field | Value |
| --- | --- |
| Task | `BOOK-001` |
| Module owner | Booking / SeatHold owner (`MEMBER_4` mapping must be confirmed on the team board) |
| Required reviewers | Room owner, Showtime owner, Payment/Ticket owner, integration owner |
| Requirement status | `APPROVED_READY` for UC20 + BR14-16,18,54-55 |
| Contract status | `APPROVED_READY` for Hà-owned SeatHold/availability scope recorded on the team task board |
| Implementation authorization | `BOOK-002..008`, `BOOK-012` SeatHold scope and `ROOM-007..008` are approved; cross-owner Booking/Payment transitions still require their named reviewers |

This document turns approved decisions A-17 through A-20 into a reviewable technical contract. It does not change the SRS, shared enums, error middleware, Room schema, Showtime schema, or Payment/Ticket contract.

## 2. Scope

`BOOK-001` defines:

- SeatHold identity, ownership, lifecycle, expiry and idempotent release;
- the read contract used to build availability for one Showtime;
- the all-or-nothing transaction boundary for acquiring multiple seats;
- persistence/index and expiry-cleanup plans;
- the Booking/Payment handoff boundary;
- the concurrency and integration test plan for `BOOK-002` and `BOOK-003`.

Out of scope:

- implementing Room, Showtime, Payment, Ticket or Refund behavior;
- payment callbacks and ticket/QR issuance;
- cancellation/refund states or policy;
- counter-specific booking rules;
- adding booked state to an embedded physical Room seat;
- Seat Selection UI and countdown implementation.

## 3. Approved invariants

1. Availability is scoped by `showtimeId + seatId`; physical Room seats contain layout state only.
2. The default hold duration is 10 minutes and comes from server configuration.
3. A client countdown uses the server-provided `expiresAt`; it is not authoritative.
4. At most one live claim may exist for a seat in a Showtime.
5. Acquiring several seats is all-or-nothing. No subset may remain held after failure.
6. Expiry and explicit release are idempotent.
7. Booking MVP transitions are `PENDING_PAYMENT -> CONFIRMED` or `PENDING_PAYMENT -> EXPIRED`.
8. A payment success received after expiry cannot confirm the Booking or issue a Ticket.
9. Counter and online channels must call the same Booking/SeatHold application service.

For this contract, a hold is **live** only when `status = ACTIVE` and `expiresAt > serverNow`. A record that is still stored as `ACTIVE` after `expiresAt` is logically expired and must not appear as held in availability results.

## 4. Terminology and identities

| Term | Contract meaning |
| --- | --- |
| `seatId` | Stable seat identity supplied by the immutable Room layout version snapshotted by the Showtime. It is not a row/label chosen by Booking. |
| `ownerId` | Authenticated account ID that owns the hold. Whether guest holds are allowed remains a review gate. |
| `checkoutKey` | Opaque client-generated idempotency key for one checkout attempt. It is not an authorization credential. |
| `holdId` | Server-generated SeatHold ID. |
| `serverNow` | Time read by the server inside the use case; client time is never used for eligibility. |
| `priceQuote` | Server-side seat price snapshot or quote reference supplied by the approved pricing owner. Booking must not trust a client amount. |

IDs are MongoDB ObjectIds serialized as strings unless an owning module's approved contract says otherwise. Timestamps on the wire are ISO 8601 UTC.

## 5. Application contracts

The interfaces below are module boundaries, not final JavaScript signatures.

### 5.1 Required upstream ports

```text
BookableShowtimeReader.getBookableShowtime(showtimeId, serverNow)
  -> { showtimeId, roomId, roomLayoutVersion, startAt, storedStatus }

RoomLayoutReader.getLayoutVersion(roomId, roomLayoutVersion)
  -> { seats: [{ seatId, row, number, type, physicalStatus }] }

SeatPriceQuoter.quote(showtimeId, seatIds, ownerId, serverNow)
  -> { quoteId?, currency: "VND", lines: [{ seatId, unitPrice }], totalAmount }
```

Booking must consume exported contracts from Room/Showtime/Pricing. It must not import their models or repositories.

The following details are unresolved dependencies and must not be guessed during implementation:

- exact Showtime status that is bookable and its cutoff relative to `startAt`;
- the Room seat identity and disabled-seat representation;
- seat-type pricing ownership and quote lifetime.

### 5.2 Seat availability query

```text
getSeatAvailability({ showtimeId, viewerOwnerId?, serverNow })
  -> {
       showtimeId,
       roomId,
       roomLayoutVersion,
       generatedAt,
       seats: [{
         seatId,
         row,
         number,
         type,
         availability: AVAILABLE | HELD_BY_CURRENT_OWNER | HELD | SOLD | UNAVAILABLE,
         holdExpiresAt?,
         price?
       }]
     }
```

The response merges the immutable Room layout version with Showtime-scoped seat state. `holdExpiresAt` may only be exposed for the current owner's hold unless the team approves broader disclosure. Availability is advisory; acquisition always revalidates inside the write transaction.

The availability literals above are response projections, not approved persistence enums. They must remain local to the Booking read contract until reviewed.

### 5.3 Acquire hold command

```text
acquireSeatHold({ ownerId, checkoutKey, showtimeId, seatIds })
  -> {
       holdId,
       ownerId,
       checkoutKey,
       showtimeId,
       seatIds,
       status: ACTIVE,
       heldAt,
       expiresAt,
       serverNow,
       priceQuote
     }
```

Preconditions evaluated by the server:

- authenticated/authorized principal according to the approved auth decision;
- non-empty, deduplicated `seatIds` within the module limit (limit remains to be approved);
- Showtime exists and is bookable at `serverNow`;
- each seat exists and is enabled in the Showtime's snapshotted Room layout version;
- every seat is still acquirable in Showtime-scoped state;
- authoritative price quote succeeds.

Idempotency rule: repeating the same `(ownerId, checkoutKey)` with the same normalized command returns the existing result. Reusing the key with a different `showtimeId` or seat set is a conflict and must not mutate either request.

### 5.4 Release command

```text
releaseSeatHold({ holdId, ownerId, reason, requestKey? })
  -> { holdId, status: RELEASED | EXPIRED, releasedAt?, expiresAt, alreadyFinal }
```

Only the owner or an explicitly authorized system use case may release a hold. Releasing an already `RELEASED` or logically/stored `EXPIRED` hold returns its current final result. A hold consumed by a confirmed booking cannot be released back to availability.

`reason` values and persistence are `PROPOSED`; they require review before becoming an enum or API field.

### 5.5 Booking handoff

```text
createPendingBookingFromHold({ holdId, ownerId, priceQuoteReference?, requestKey })
  -> { bookingId, status: PENDING_PAYMENT, payableReference, expiresAt, amount, currency }
```

The operation must validate hold owner, live expiry, seat claims and server-side price snapshot within its consistency boundary. The returned `payableReference` is the only reference Payment may use. Payment must call an exported Booking completion port; it must not update SeatHold, Booking or ShowtimeSeat persistence directly.

```text
confirmBookingAfterVerifiedPayment({ payableReference, paymentId, processingKey, verifiedAt })
  -> CONFIRMED | ALREADY_CONFIRMED | EXPIRED_REVIEW_REQUIRED
```

`EXPIRED_REVIEW_REQUIRED` creates no Ticket. Exact Payment status mapping is owned by `PAY-001` and is not defined here.

## 6. Proposed persistence model

This section is a technical proposal that requires the reviewers listed in section 1.

### 6.1 `seat_holds`

```text
SeatHold
  _id
  ownerId
  checkoutKey
  showtimeId
  roomLayoutVersion
  seatIds[]
  status: ACTIVE | RELEASED | EXPIRED | CONSUMED       # proposed module enum
  heldAt
  expiresAt
  releasedAt?
  consumedAt?
  priceSnapshot
  commandHash
  createdAt
  updatedAt
```

Proposed indexes:

- unique `{ ownerId: 1, checkoutKey: 1 }` for acquire idempotency;
- `{ showtimeId: 1, status: 1, expiresAt: 1 }` for active-hold lookup and cleanup;
- TTL `{ expiresAt: 1 }` may remove old terminal records only after a separately approved retention field/policy. It must not be the correctness mechanism.

### 6.2 `showtime_seats`

One record represents one physical seat in one Showtime and is the compare-and-set target.

```text
ShowtimeSeat
  _id
  showtimeId
  seatId
  roomLayoutVersion
  state: AVAILABLE | HELD | SOLD | UNAVAILABLE         # Booking module enum
  holdId?
  holdOwnerId?
  holdExpiresAt?
  bookingId?
  priceSnapshot?
  createdAt
  updatedAt
```

Proposed indexes:

- unique `{ showtimeId: 1, seatId: 1 }` — the database invariant preventing duplicate Showtime-seat state;
- `{ holdId: 1 }` for release/consume operations;
- `{ showtimeId: 1, state: 1 }` for availability reads.

No field is added to `Room.seats[]` for booking state.

### 6.3 Why per-seat state is the primary proposal

- the unique key directly models the approved `Showtime + Seat` invariant;
- `SOLD` prevents a new hold after the original SeatHold becomes terminal;
- the same records support availability reads and atomic compare-and-set;
- SeatHold remains the owner/expiry/idempotency aggregate rather than duplicating Room layout.

A single SeatHold document with a multikey unique index on `seatIds` was considered but rejected as the primary plan because it does not independently represent confirmed sale state and makes the hold-to-sale transition less explicit.

## 7. Transaction plan

### 7.1 Acquire multiple seats

The primary plan requires MongoDB transactions on a replica set.

1. Normalize and sort unique `seatIds`; compute `commandHash`.
2. Look up `(ownerId, checkoutKey)` outside or at the start of the transaction.
   - Same hash: return the existing result.
   - Different hash: return idempotency conflict.
3. Read bookable Showtime and immutable Room layout through their exported ports.
4. Obtain the authoritative price quote.
5. Start a MongoDB session and transaction.
6. Re-read or initialize all requested `ShowtimeSeat` records for the Showtime/layout version.
7. Treat `HELD` with `holdExpiresAt <= serverNow` as reclaimable. Never reclaim `SOLD`.
8. Compare-and-set every requested seat to `HELD` with the new `holdId`, owner and expiry. Each update predicate must accept only `AVAILABLE` or an expired `HELD` state.
9. If the number of successfully claimed seats is not exactly the requested count, abort the transaction.
10. Insert the `SeatHold` and its price snapshot in the same transaction.
11. Commit. A duplicate-key/write-conflict is mapped to a seat conflict; the caller may refresh availability.

The transaction retries only MongoDB-labeled transient transaction errors and uses a bounded retry count. It does not retry validation or seat-conflict errors.

### 7.2 Release or expire

In one transaction:

1. Load SeatHold by `holdId` and verify ownership/authorized system caller.
2. If terminal, return the stored result without mutation.
3. For expiry, require `expiresAt <= serverNow`; explicit owner release may occur earlier.
4. Compare-and-set only `ShowtimeSeat` records with the same `holdId` from `HELD` to `AVAILABLE` and clear hold fields.
5. Move SeatHold to `EXPIRED` or `RELEASED` and set the corresponding timestamp.
6. Commit.

Repeated calls are safe because terminal SeatHold states return without reopening seats. A seat already moved to `SOLD` is never changed by release/expiry.

### 7.3 Consume/confirm boundary

Confirmation is not implemented by `BOOK-001`, but the required transaction boundary is:

- verify Booking is `PENDING_PAYMENT`, the payment result is authoritative and the hold was live at the approved success boundary;
- compare-and-set all matching `ShowtimeSeat` rows from `HELD` with the same `holdId` to `SOLD` and attach `bookingId`;
- transition SeatHold to `CONSUMED` and Booking to `CONFIRMED` exactly once;
- emit/call Ticket issuance only after the authoritative transition, with an idempotency key owned by the Payment/Ticket contract.

If the Booking/hold has expired, the transaction performs none of these changes and returns the late-payment result for manual review/refund handling.

## 8. Expiry cleanup plan

Correctness uses server-time predicates and lazy expiry, never TTL timing.

Primary proposal:

- **lazy cleanup on write:** acquire may reclaim a `HELD` seat only when `holdExpiresAt <= serverNow` and closes the corresponding expired hold inside the transaction;
- **lazy cleanup on read:** availability projects an expired `HELD` record as available, but does not claim it;
- **scheduled cleanup:** a bounded worker scans `{ status: ACTIVE, expiresAt: { $lte: serverNow } }` and invokes the same idempotent expiry use case in batches;
- **startup/operational recovery:** the same worker can safely retry after downtime.

The scheduler contains no business logic. Frequency, batch size, lease/leader strategy and terminal-record retention are deployment decisions to approve before implementation.

## 9. Authorization and information exposure

- Hold mutation routes are protected and default-deny through `requireAuth` plus the approved permission policy where applicable.
- A frontend guard is never the security boundary.
- Owner identity is derived from authenticated server context, not accepted from a client body.
- Availability must not expose another customer's owner ID or checkout key.
- Branch-scoped authorization is not inferred because its contract is not approved.

Whether availability itself is public and whether creating a hold requires authentication are explicit review gates from the team plan.

## 10. Proposed REST surface

These routes and error codes are contract candidates, not approved shared API changes.

| Method | Route | Purpose | Auth proposal |
| --- | --- | --- | --- |
| `GET` | `/api/showtimes/:showtimeId/seats` | Merged availability and prices | Review: public or optional identity |
| `POST` | `/api/seat-holds` | Atomically acquire requested seats | Authenticated |
| `GET` | `/api/seat-holds/:holdId` | Restore countdown/current state | Owner/authenticated |
| `DELETE` | `/api/seat-holds/:holdId` | Idempotent owner release | Owner/authenticated |
| `POST` | `/api/bookings` | Create pending Booking from live hold | Owner/authenticated |

Candidate acquire request:

```json
{
  "showtimeId": "object-id",
  "seatIds": ["seat-id-A1", "seat-id-A2"],
  "checkoutKey": "opaque-client-key"
}
```

Candidate error codes:

- `INVALID_SHOWTIME_ID`, `INVALID_HOLD_ID`, `INVALID_SEAT_IDS`;
- `SHOWTIME_NOT_BOOKABLE`, `SEAT_NOT_IN_LAYOUT`, `SEAT_UNAVAILABLE`;
- `HOLD_NOT_FOUND`, `HOLD_FORBIDDEN`, `HOLD_EXPIRED`;
- `IDEMPOTENCY_KEY_REUSED`;
- `PRICE_QUOTE_FAILED`.

Owners of shared error/API conventions must approve names and status mapping before route implementation. No consumer may branch on these proposed literals yet.

## 11. Failure semantics

| Failure | Required outcome |
| --- | --- |
| One requested seat is unavailable | Acquire fails; zero requested seats remain newly held |
| Two callers race for the same seat | At most one transaction commits; the loser receives a conflict |
| Same checkout request is retried | Same hold/result is returned; expiry is not extended implicitly |
| Same idempotency key has different payload | Conflict; no mutation |
| Commit result is ambiguous | Resolve by `(ownerId, checkoutKey)` before retrying |
| Client clock is wrong | No effect on eligibility or expiry |
| Cleanup worker runs twice | Same terminal result; seats are not reopened from `SOLD` |
| Payment arrives after expiry | No Booking confirmation and no Ticket issuance |
| Room layout changes after publish | Hold uses the Showtime's snapshotted `roomLayoutVersion`; no silent remap |

Automatic hold extension is not part of the approved scope.

## 12. Concurrency and integration test plan

### 12.1 Service/contract tests

- reject empty, duplicate, invalid and over-limit seat lists;
- reject non-bookable/missing Showtime and seats absent/disabled in the layout snapshot;
- derive `expiresAt` from server configuration and server time;
- make acquire idempotent for identical requests and conflicting for changed payload;
- make release/expiry idempotent;
- reject owner mismatch without leaking hold details;
- ensure late payment returns review-required behavior and never invokes Ticket issuance.

### 12.2 MongoDB integration tests

- 20 or more concurrent requests for the same Showtime/seat produce exactly one winner;
- overlapping multi-seat requests never partially commit;
- failure after the first internal seat update rolls back all seat updates and SeatHold insert;
- the same physical `seatId` can be held independently in different Showtimes;
- expired hold can be reclaimed, while `SOLD` cannot;
- concurrent release and acquire produce one valid final owner/state;
- duplicate release/expiry workers do not reopen a sold seat;
- duplicate `(ownerId, checkoutKey)` cannot create multiple holds;
- transaction retry after transient error preserves one logical hold;
- Room layout version mismatch fails without mutation.

### 12.3 Route tests

- validation errors follow the approved API envelope;
- no identity returns `401` on protected commands;
- wrong owner/permission returns `403` without mutation;
- seat conflict maps to approved `409`/business error contract;
- availability does not expose another owner's identity;
- timestamps are ISO 8601 UTC and amounts are integer VND.

Tests must use a database separate from development and capable of replica-set transactions. A standalone MongoDB test instance is insufficient for the primary plan.

## 13. Observability requirements

Record non-sensitive fields needed to investigate concurrency without logging tokens or personal data:

- request/correlation ID;
- module/use case;
- actor ID where authorized;
- showtime ID, hold ID and seat count;
- transaction attempt/result and stable error code.

Do not log checkout keys, auth cookies, full request bodies or payment secrets.

## 14. Review gates before `BOOK-003`

All items below must be recorded as approved on the task board/contract review before DB workflow implementation:

- [ ] Confirm real person mapped to Booking owner / `MEMBER_4` and reviewers.
- [ ] Room owner approves stable `seatId`, physical status and `roomLayoutVersion` read port.
- [ ] Showtime owner approves bookable-state/cutoff read port.
- [ ] Pricing owner approves quote/snapshot fields and seat-type pricing boundary.
- [ ] Payment/Ticket owner approves `payableReference`, expiry and verified-success port.
- [x] Team task board approves `SeatHold`/`ShowtimeSeat` transaction/index work for `BOOK-004`.
- [ ] Infrastructure owner confirms production and isolated test MongoDB run as replica sets with transactions.
- [ ] Team approves lazy + scheduled cleanup topology and operational ownership.
- [ ] Auth owner decides public availability and authentication/permission rules for hold creation.
- [ ] API owner approves routes, payload limits, error codes and response envelope.
- [ ] Integration owner approves route mounting/shared-file changes.

If replica-set transactions cannot be provided, stop `BOOK-003`. A different persistence design must receive a new concurrency review; application-level loops or compensating releases are not acceptable substitutes for the approved all-or-nothing invariant.

## 15. Consumer handoff

### Room owner

Provide immutable layout lookup by `roomId + roomLayoutVersion`, including stable `seatId` and physical enabled/disabled state. Booking will not mutate Room seats.

### Showtime owner

Provide bookable Showtime read contract and snapshot version. Booking will not redefine Showtime lifecycle.

### Payment/Ticket owner

Consume only `payableReference` and exported confirmation result. Do not import or mutate Booking persistence. Ticket issuance must remain downstream of authoritative verified success.

### Seat Selection UI

Use availability projection and `expiresAt/serverNow` for display countdown. A zero countdown triggers refresh/expired UX; it is not proof that release has committed. The UI must handle loading, error, empty, conflict-refresh and expired states.

### Counter Ticketing

Reuse the same acquire/release/create-booking contracts. No counter-only seat locking or alternative source of truth is permitted.
