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

