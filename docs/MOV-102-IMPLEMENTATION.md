# MOV-102 — Update Movie

## Reviewed scope and sources

Read `AGENTS.md`, project conventions and requirements status, SRS Group 5 UC15 §3.2.7 and UC17/18 plus BR-09/10/11/13/44, movie-management detailed design, Screen Flow §4 and the Manager diagram, Stitch project `12758682447811659045` screen **Update Movie — F-Cinema Executive Portal**, and Team Development Plan Task Board, Module Ownership, API & Data Contracts, Requirement Decisions.

Initial branch: `movie`; initial working tree clean. Existing MOV-101 implementation, genre multi-select, age rating options, lifecycle and unique index are retained. No commit, push, merge, task-board mutation or development database migration is part of this task.

## Behavior and additive management contract

Movie owner: Hiếu / MEMBER_1. Consumers: Manager Movie catalog/edit UI; Showtime and public discovery continue using their existing read contracts. Backend requires current authenticated account, `movie.update`, and the UC15 `MANAGER` actor for every management read/write. Direct grants remain part of effective permissions.

| Endpoint | Request | Response |
| --- | --- | --- |
| `GET /api/movies/manage` | Existing bounded Movie list query, except `status` is not accepted; all lifecycle states are visible | `{ success: true, data: Movie[], meta }` |
| `GET /api/movies/:id/manage` | ObjectId | `{ success: true, data: Movie }`, including Draft/Archived |
| `PATCH /api/movies/:id` | Nonempty strict partial metadata/runtime object | `{ success: true, data: Movie }` |

Management DTO uses the existing Movie fields plus `updatedAt` (ISO UTC, nullable for legacy records without a timestamp). Detail/update additionally return `canEditDuration`. Public/create DTOs remain unchanged. PATCH permits only `title`, `synopsis`, `genres`, `cast`, `releaseDate` (`YYYY-MM-DD`), `language`, `director`, `ageRating`, `posterUrl`, `trailerUrl`, and a positive integer `duration`. Required values cannot be cleared; optional cast/trailer may be cleared. IDs, status, releaseYear, timestamps and arbitrary internal fields cannot be written. Uses existing error envelope/codes (`INVALID_QUERY`, `INVALID_MOVIE_ID`, `INVALID_MOVIE_INPUT`, `MOVIE_NOT_FOUND`, `MOVIE_DUPLICATE`, authorization errors). A changed duration with references returns 409 `INVALID_MOVIE_INPUT` with a duration field error; the entire PATCH is rejected. An unchanged duration may accompany a metadata edit.

Frontend paths: `/manager/movies` and `/manager/movies/:movieId/edit`. The minimal internal catalog supplies search, pagination and Edit Details for all states. Cancel returns to the catalog with no save request or success message. The form preloads persisted values, retains edits on failed saves, shows request/permission/not-found/loading/saving/success states, and rebaselines only from a successful server response. GenreMultiSelect and the age-rating dropdown are shared with Add Movie; unrecognized legacy rating values remain visible. Save sends only changed metadata, preserving untouched array values and internal/lifecycle state.

These exact management paths were absent from the live Team Plan registry. Their implementation is additive under this user's explicit MOV-102 request and authorization to supplement management read contracts; **owner/consumer integration approval remains NEEDS_REVIEW before merge**. Shared frontend router/layout require cross review. There is no claim that an AI proposal is an approved Team Plan decision.

## Data integrity and dependency boundary

No new schema, enum, permission, index or database relationship. Uses MOV-101's existing exact trimmed title + UTC release year unique invariant across all statuses. Update precheck excludes the current movie; duplicate-key races map to `MOVIE_DUPLICATE`. When changing releaseDate, the same atomic update derives/stores releaseYear. MOV-101 migration `20261020-movie-create-index.js` remains a rollout prerequisite, including backfill of legacy records and creation of the unique index. This task does not run that migration on development data.

Duration is editable only when no Showtime references the Movie. Existing references lock the duration field alone, including DRAFT Movies with legacy/import references. Backend rechecks at save time; the UI capability is advisory. Independent metadata updates are not blanket-blocked because a movie has Showtimes. Archive/publish transitions and MOV-103 are out of scope.

### Owner duration clarification — 2026-10-21

The owner approved duration editing for a Movie without any Showtime reference, including DRAFT before publication. The follow-up explicitly confirmed that a DRAFT with references remains locked. The owner will handle old data themselves; no data deletion was performed. This supersedes the earlier runtime blocker and does not authorize publication/archive transitions.

### Shared Movie–Showtime runtime contract

- Showtime owner exports `showtimeReferenceService.hasMovieReferences(movieId, session)` from `showtime-reference.service.js`; Movie consumes it. It checks existence across all statuses/times and fails closed on query failure. The separate read-service entry avoids a circular import; Movie never imports Showtime internals.
- Movie owner exports `movieService.withMovieForScheduling(movieId, work)`; Showtime consumes it. It locks/reloads a PUBLISHED Movie in a transaction and supplies the DTO/session. Showtime inserts its DRAFT within that same transaction, then initializes seats and publishes using the existing flow. Failure before insertion rolls back; existing cleanup still handles later failures.
- Runtime updates acquire the same Movie write dependency, then check references and save the entire patch inside the transaction. Existing Mongoose `__v` is incremented internally to serialize writers; scheduling does not alter Movie `updatedAt`. No new schema/index/relationship or migration; missing legacy `__v` initializes on increment. Mongo transaction support is now required for duration changes and Showtime creation. Standalone deployments fail safely; no check-then-write fallback.
- Raw/import writers creating Showtimes must run offline or use this protocol. Rescheduling already-referenced Movies requires no duration mutation path; their runtime remains locked. Existing intervals, layout/price snapshots and transaction history are untouched.
- Business policy is approved by the user. Exact shared contract implementation/capability and transaction rollout need Movie/Showtime/Booking cross review before merge; technical integration approval remains NEEDS_REVIEW.

## Verification

### Duration follow-up verification

- Combined backend regression: `node --test --test-concurrency=1 test/movie-create.test.js test/movie-create.mongo.test.js test/movie-update.test.js test/movie-update.mongo.test.js test/movie.test.js test/ticket-pricing.test.js test/showtime-merge-integration.test.js`: **66/66 pass, 0 skipped**. Then the Mongo duration suite was strengthened to observe the competing Mongo `findAndModify` command while the first transaction holds the Movie guard; rerun **14/14 pass, 0 skipped**. Both transaction orderings are verified against the real Movie/Showtime repositories, not only mocks. Unreferenced DRAFT edits, every referenced lifecycle/time, whole-patch rejection, same-runtime metadata updates, fail-closed queries and scheduling's PUBLISHED eligibility are covered. Test databases were isolated and cleaned; no user data was deleted. Existing Showtime `new: true` calls emit Mongoose deprecation warnings during publication.
- Client helpers plus public search regression: **15/15 pass**. Scoped backend/client ESLint and production client build pass. Full client lint still fails only at the previously recorded untouched Showtime page error/warning; build retains the bundle-size warning.
- Browser QA with a temporary memory-only fixture and the actual backend body parser: unreferenced DRAFT runtime 120 → 135 saves and rebaselines; when a reference appears after load, the 409 response retains duration 150 and the unsaved synopsis; reload returns runtime 135 read-only; synopsis-only editing still succeeds. Captured requests were `{ duration: 135 }`, rejected `{ duration: 150, synopsis: ... }`, then `{ synopsis: ... }`. Fixture/server/tabs removed after verification. Real backend enforcement and concurrent persistence were tested separately above.

### Initial metadata implementation (before duration follow-up)

- Backend: `node --test --test-concurrency=1 test/movie-create.test.js test/movie-create.mongo.test.js test/movie-update.test.js test/movie-update.mongo.test.js test/movie.test.js` in `server`: **50/50 pass, 0 skipped**. Includes live HTTP/current-account authorization, direct grants/revocation/locking, all lifecycle admin reads, strict field validation, self exclusion, archived duplicate conflicts, concurrent uniqueness, sparse title/date changes, timestamps, and preserved synthetic Showtime reference/snapshot data. Mongo suites used fresh task-specific database names and cleaned them in `finally`; no development data was changed.
- Backend ESLint on the Movie module and new tests: **pass**. Client ESLint on `features/manager-movies`, router, ManagerLayout and `test/movie-form.test.js`: **pass**. `git diff --check`: **pass**.
- Client: `node --test test/movie-form.test.js test/movie-search-params.test.js`: **14/14 pass**. Covers preload, changed-field whitelist, untouched comma-containing cast, optional clearing, saved baseline, existing create payload/validation, and error classification.
- Client `npm run build`: **pass**; existing bundle-size warning (>500 kB) remains. Full `npm run lint`: **fails** at untouched `ManagerShowtimesPage.jsx:106` (`react-hooks/immutability`) plus warning at line 383 (`exhaustive-deps`). Both were confirmed before MOV-102 changes and left visible.
- Manual browser QA used an isolated loopback Vite fixture with the real routed client, actual backend parser/service and an in-memory repository. All `/api` requests were intercepted, never proxied to a development server/database. Verified Draft preload, selected genres/rating, chip removal/search/duplicate prevention, one selected rating, changed-field payload, retained form after 409/500, success and timestamp rebaseline, Cancel without an extra PATCH, catalog search/no-result, backend 403, frontend missing-permission 403, missing movie 404, load failure/retry recovery, explicit loading/saving and disabled form during saving, and MOV-101 Save Draft success/reset. Desktop layout inspected; actual 390px iframe viewport measured content width 375px (no horizontal overflow). This fixture does not substitute for the separate real backend RBAC/Mongo tests above. Temporary QA server/file were removed after inspection.
- Independent read-only backend/frontend cross reviews found no material issue. These agent reviews do not replace the required team owner/consumer integration approval.

## Changed files

- Backend: `server/src/modules/movie/movie.routes.js`, `movie.controller.js`, `movie.service.js`, `movie.repository.js`, `movie.validation.js`.
- Backend tests: `server/test/movie-update.test.js`, `server/test/movie-update.mongo.test.js`.
- Duration follow-up integration: `server/src/modules/showtime/showtime-reference.service.js`, `showtime.repository.js`, `showtime.service.js`; test adapter in `server/test/ticket-pricing.test.js` now injects the scheduling guard.
- Client feature: `client/src/features/manager-movies/api/managerMovieApi.js`, `components/MovieFormFields.jsx`, `components/MovieManagementAccess.jsx`, `pages/AddMoviePage.jsx`, `pages/ManagerMoviesPage.jsx`, `pages/UpdateMoviePage.jsx`, `utils/movieForm.js`.
- Shared client integration: `client/src/app/router/index.jsx`, `client/src/layouts/ManagerLayout.jsx`.
- Client tests: `client/test/movie-form.test.js`.
- Documentation: `docs/REQUIREMENTS_STATUS.md` (records the blocker without changing existing approval decisions), this report.
