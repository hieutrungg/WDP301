# Movie Management Class Design

## Scope and Business Flow

Supports adding, editing, listing, and archiving movies while preventing duplicates and preserving references from showtimes/bookings.

## Current Design Review

- Keep Movie as the aggregate and soft archive rather than delete.
- Merge the unnecessary service interface/implementation pair into one application service unless multiple implementations are required.
- Move duplicate-title/release-date checks into a repository query plus a named uniqueness policy.
- Model genres as value objects/references owned by the catalog, not a repository inheritance hierarchy displayed in every class diagram.
- `Movie.updateInfo` and `Movie.archive` should enforce valid transitions.

## Proposed Responsibilities and Relationships

`ManageMovieService` coordinates commands and loads/saves the aggregate. `MovieUniquenessPolicy` isolates duplicate checks. DTO validation happens at the API boundary; business validation remains in Movie.

Assumption: archiving prevents new showtimes but does not invalidate historical bookings.

