# Showtime Management Class Design

## Scope and Business Flow

Supports creating, modifying, listing, publishing, and canceling showtimes. A schedule must not overlap in one room; published/sold showtimes have stricter edit and cancellation rules.

## Current Design Review

- Keep a focused conflict policy, Showtime aggregate, and repositories for showtimes and room/movie references.
- Remove TicketRepository from normal showtime commands; ticket-sale state should be obtained through a stable sales-status port.
- Do not generate static seat IDs when creating a showtime. Create a showtime seat-availability snapshot or initialize availability through Booking after publication.
- The existing diagram allows an entity and repository to be updated independently, which obscures the aggregate transaction.

## Proposed Responsibilities and Relationships

`ShowtimeManagementService` loads reference data through ports, asks `ScheduleConflictPolicy`, changes the `Showtime` aggregate, and persists it. `SalesStatusPort` protects sold showtimes without importing Ticket infrastructure. `SeatAvailabilityInitializer` creates per-showtime availability from the room layout after publication.

Open Design Question: define whether emergency cancellation with sold tickets automatically starts a refund workflow.

