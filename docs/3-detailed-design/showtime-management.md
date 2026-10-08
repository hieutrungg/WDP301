# Showtime Management Class Design

## Scope and Business Flow

Supports creating, modifying, listing, publishing, and canceling showtimes. A schedule must not overlap in one room; published/sold showtimes have stricter edit and cancellation rules.

## Current Design Review

- Keep a focused conflict policy, Showtime aggregate, and repositories for showtimes and room/movie references.
- Remove TicketRepository from normal showtime commands; ticket-sale state should be obtained through a stable sales-status port.
- Do not generate static seat IDs when creating a showtime. Create a showtime seat-availability snapshot or initialize availability through Booking after publication.
- The existing diagram allows an entity and repository to be updated independently, which obscures the aggregate transaction.

## Approved Lifecycle and Scheduling Rules

- Persist only `DRAFT`, `PUBLISHED`, and terminal `CANCELLED`.
- Derive `UPCOMING`, `NOW_SHOWING`, `ENDED`, and `SOLD_OUT` at read time; do not persist them as lifecycle states.
- Manager supplies `startAt`; calculate the conflict `endAt` from Movie duration plus configurable cleanup time, default 15 minutes.
- Store instants in UTC and interpret date filters in `Asia/Ho_Chi_Minh` before converting them to a UTC range.
- Same-Room intervals use `[startAt, endAt)`: overlap is rejected, while a next Showtime may start exactly at the prior `endAt`.
- Publish requires eligible Movie, active Branch/Room, future time, no overlap, and a valid Room layout. Publishing records `roomLayoutVersion` and initializes Showtime-scoped availability.
- A published Showtime may be edited or cancelled only before it starts and while no active SeatHold, Booking, Payment, or Ticket exists.
- Cancellation with sales/transactions remains blocked until the Refund contract is approved.

## Responsibilities and Relationships

`ShowtimeManagementService` loads reference data through ports, asks `ScheduleConflictPolicy`, changes the `Showtime` aggregate, and persists it. `SalesStatusPort` protects sold showtimes without importing Ticket infrastructure. `SeatAvailabilityInitializer` creates per-showtime availability from the room layout after publication.

Deferred Design Question: cancellation with sold tickets and automatic/manual refund behavior remain outside this approved contract.

