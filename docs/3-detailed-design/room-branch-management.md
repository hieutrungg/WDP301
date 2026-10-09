# Room and Branch Management Class Design

## Scope and Business Flow

Supports branch updates, room management, seat-map viewing/configuration, seat types, capacity calculation, and protection of layouts referenced by published future showtimes.

## Current Design Review

- Keep Branch, Room, Seat/SeatType concepts and the showtime lock rule.
- A Room is part of a Branch; a Seat definition is part of one Room. The current diagrams show IDs but omit composition and multiplicities.
- Replace delete-all/save-all seat updates with aggregate replacement plus versioning/validation. A destructive update can break showtime-seat references.
- Separate branch contact updates from room layout changes; they have different policies and repositories.
- Capacity is derived from enabled seats and should not be independently editable.

## Approved M0 Branch Contract

- Branch fields: required normalized-unique `branchName`, required `address`, optional `email`, optional `hotline`, and `status` in `ACTIVE/INACTIVE`.
- Public discovery returns only `ACTIVE` branches. Only an active Branch/Room may receive a new Showtime.
- A referenced Branch is never hard-deleted. Transition to `INACTIVE` is blocked while it has a future `PUBLISHED` Showtime; Rooms and historical records remain intact.
- Operating hours and branch-scoped RBAC are outside M0.
- Development seed must create Branch, Room, and valid layout fixtures idempotently.

## Responsibilities and Relationships

Branch is an aggregate for branch metadata. Room is a separate aggregate because layout changes have their own consistency rule. Room owns an immutable/versioned `SeatLayout` composed of `SeatDefinition` values. Published showtimes reference the layout version or receive a snapshot.

Old layout versions remain queryable for historical records and any future Showtime that already references that version.

