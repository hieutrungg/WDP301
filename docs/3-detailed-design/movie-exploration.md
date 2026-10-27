# Movie Exploration Class Design

## Scope and Business Flow

Supports browsing/searching active movies, viewing details and available showtimes, reading reviews, and posting a review after an eligible completed booking.

## Current Design Review

- Keep Movie, Genre, MovieReview, query controller, and review eligibility based on booking history.
- Split read queries from review commands; the current controller and service mix two different capabilities.
- Replace direct dependencies on Movie, Genre, Showtime, Booking, and Review repositories with two focused ports: catalog queries and review persistence/eligibility.
- A review belongs to one account and one movie; enforce at most one review per customer/movie if that is the intended rule.
- Do not expose `JpaRepository` or database mapping calls.

## Proposed Responsibilities and Relationships

`MovieCatalogQueryService` serves optimized read views. `SubmitMovieReview` loads eligibility through `ReviewEligibilityPort`, creates a `MovieReview`, and persists it. `Movie` owns catalog state; showtimes are only projections in the movie detail response because Scheduling owns showtime lifecycle.

Open Design Question: confirm whether multiple reviews per customer/movie are allowed and whether reviews require showtime completion or merely a paid booking.

## Owner approval and implementation — 2026-10-27

Hiếu resolved the preceding historical question: one review per Customer/Movie, after a confirmed paid non-refunded screening reaches stored endAt (including cleanup); no check-in requirement. Immediate publication, integer 1–5 and optional content up to 2,000 characters are approved. Create only; no edit/delete, moderation queue or loyalty reward. REV-102 uses Booking-owned eligibility with owning-module Payment/Showtime/Refund ports, and a separate Movie write adapter over the same movie_reviews collection as REV-101. The unique-index migration requires explicit target approval before development-Atlas apply. See `../REV-102-IMPLEMENTATION.md` for contracts, concurrency, tests and rollout status. This note records chat approvals and does not rewrite the SRS.

