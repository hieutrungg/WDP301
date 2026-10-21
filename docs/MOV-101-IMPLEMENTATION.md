# MOV-101 — Add New Movie

Scope: UC14 / BR13; Hiếu owns Movie API/UI. Reviewed sources: SRS Group 5 UC14, approved A-13 / DEC-002 lifecycle, SCREEN_FLOW §4 and manager diagram, Stitch project 12758682447811659045 “Add New Movie — F-Cinema Executive Portal”, and Team Development Plan task/contract/decision tabs. User approved poster URL input in place of upload for this task on 2026-10-20.

## Behavior and additive contract

- Manager navigation → `/manager/movies/new`. Requires current MANAGER role and `movie.create`; frontend checks support navigation only.
- `POST /api/movies`: HTTP-only auth cookie → requireAuth → requirePermission(`movie.create`) → requireRole(`MANAGER`). Uses current account grants including direct grants.
- JSON body: `title`, `synopsis`, nonempty `genres[]`, positive integer `duration`, `releaseDate` (YYYY-MM-DD), `language`, `director`, `ageRating`, HTTP(S) `posterUrl`; optional `cast[]`, `trailerUrl` (HTTP(S) or empty), `status` (`DRAFT` default or `PUBLISHED`). Unknown fields rejected. Status ARCHIVED is unavailable during creation.
- Response 201 `{ success: true, data: <existing Movie DTO> }`. Additive module codes: 400 `INVALID_MOVIE_INPUT` with field errors; 409 `MOVIE_DUPLICATE`. Existing auth/permission errors apply. Public read contracts are unchanged.
- SRS duplicate rule: exact trimmed title + UTC release year, across all statuses. No force-add bypass. Save Draft uses DRAFT; Save Movie uses PUBLISHED after validation. Approved lifecycle supersedes SRS “Active/Coming Soon”.
- Form displays inline validation/server errors, saving state, success confirmation and poster preview/fallback. Cancel returns to Manager home. A future Movie Management list is outside MOV-101.

## Database and integration review

- Add derived `movies.releaseYear` and unique partial index `movie_title_release_year_unique` on `(title, releaseYear)`. It is not exposed in the existing Movie DTO. Seed writes maintain the derived year.
- Migration `server/src/migrations/20261020-movie-create-index.js` defaults to read-only preflight. After review, stop movie writes and run `node src/migrations/20261020-movie-create-index.js --apply` from server. It rejects invalid records/duplicate title-year groups, backfills legacy records, and creates the index. No existing movie is deleted. Re-running is idempotent.
- Migration must precede rollout. All future Movie writers (including MOV-102) must maintain releaseYear. Application precheck covers legacy records; the unique DB index enforces concurrent creates. Raw/import writes must follow the same invariant.
- Owner: Hiếu. Consumers: Manager form, future Movie management, public catalog and Showtime read consumers. API is additive; data migration required. Backend RBAC/schema/index/seed reviewer: Cường and affected module owners. Shared frontend router and ManagerLayout require integration review.
- Approval: task/lifecycle approved; implementation contract, new error codes and index/migration await cross-review before merge. No remote task status changed; no development DB migration performed by this task.

## Changed files

- Backend: `server/src/modules/movie/movie.{routes,controller,validation,service,repository,model}.js`.
- Data: `server/src/seeds/seed-movies.js`, `server/src/migrations/20261020-movie-create-index.js`.
- Frontend: `client/src/features/manager-movies/api/managerMovieApi.js`, `client/src/features/manager-movies/pages/AddMoviePage.jsx`, `client/src/app/router/index.jsx`, `client/src/layouts/ManagerLayout.jsx`.
- Verification: `server/test/movie-create.test.js`, `server/test/movie-create.mongo.test.js`; this implementation report.

## Verification — 2026-10-20

- `node --test --test-concurrency=1 test/movie-create.test.js test/movie-create.mongo.test.js test/movie.test.js`: **24/24 pass**, including real MongoDB/HTTP tests on fresh task-specific databases removed after each run. Uses existing configured Mongo DNS resolver; initial attempt without that resolver failed DNS, then the suite passed after using the project helper.
- `node --test test/movie-search-params.test.js` in client: **4/4 pass**.
- ESLint on all changed client/server JS/JSX: **pass**. `npm run build` in client: **pass**, with the existing bundle-size warning.
- Full client `npm run lint`: **fails** at untouched `ManagerShowtimesPage.jsx:106` (`react-hooks/immutability`), plus an existing dependency warning at line 383. No unrelated code changed to hide these findings.
- Broader `development-seed.test.js`: 6 pass, 1 failure in untouched SeatHold seed expectation (`priceSnapshot` expected 90000, got undefined). Movie fixture/seed checks pass.
- Browser check on an isolated UI fixture (test Manager session and in-memory Movie repository, not a production session): desktop two-column form, poster preview, Save Draft success/reset, mobile layout at 390px without horizontal overflow. Actual backend authorization/persistence/concurrency are covered separately by the real Mongo/HTTP suite above.
- No new runtime dependencies. No deployment, push, merge or development DB migration. Remaining integration requirements: reviewers approve the additive contract/schema/index and apply the migration before rollout; existing unrelated lint/seed failures remain visible.

## Film Genres UX update — 2026-10-21

- Files: `client/src/features/manager-movies/components/GenreMultiSelect.jsx`, `client/src/features/manager-movies/data/genres.js`, `client/src/features/manager-movies/pages/AddMoviePage.jsx`, this report.
- Replaced comma-delimited genre entry with a controlled searchable multi-select: removable chips, selected checkmarks, duplicate prevention, persistent dropdown after selection, capped scrolling, empty search state, outside/blur/Escape dismissal, Arrow Up/Down + Enter selection and Backspace removal when the search is empty. No arbitrary genre creation. Existing dark surfaces and primary coral accent retained; page layout unchanged.
- Backend has no genre catalog endpoint or genre enum. Uses the 18 fallback names explicitly supplied by the user. Does not infer available genres by scanning paginated public movies. The component accepts an `options` prop for a future catalog provider and a `value` array for preloaded/edit values; external array changes render directly, preserving existing names. There is no Movie edit screen in this checkout, so an edit workflow cannot yet be tested end to end.
- Form state now stores `genres` as an array; submit validates at least one selection and passes the same name array to `POST /api/movies`. Trimming of other string fields and cast parsing remain unchanged. Search text is excluded from the request. Server field errors remain connected via `aria-invalid`/`aria-describedby`; selected chips survive server errors and clear after success.
- Accessibility: labelled combobox, multi-select listbox, selected options, active-descendant navigation, live selected-value announcement, named remove/toggle buttons, visible focus and disabled controls. No dependencies added; no backend/API/DB/governance changes in this UX update.
- Verification: targeted feature ESLint and production build pass (existing bundle-size warning). Existing Movie unit/route suites: **15/15 pass**. Browser checks on temporary local fixtures covered preloaded/external values, search trimming/case, selecting/removing multiple genres, duplicate prevention, remaining open, no-match/Enter without arbitrary creation, Arrow Up/Down/Enter/Backspace, Escape/outside dismissal, disabled controls, required-field errors, server-error retention, successful create/reset and exact captured request `genres: ["Action", "Drama", "Science Fiction"]`. The fixture uses the actual backend create-body parser; it does not write to a database. Desktop 1440px and mobile 390px inspected; mobile has no horizontal overflow. Temporary QA files are removed after testing.
- Full client lint was rerun after QA cleanup: still fails only at the untouched `ManagerShowtimesPage.jsx:106` immutability error, plus its existing line 383 dependency warning.

## Age Rating single-select — 2026-10-21

- Files: `client/src/features/manager-movies/data/ageRatings.js`, `client/src/features/manager-movies/pages/AddMoviePage.jsx`, this report.
- Replaced the text field with a required native single-select, retaining the same label, input styling, form state, server error wiring and disabled fieldset. Placeholder is empty/disabled; selecting a new rating replaces the previous value. Uses existing runtime Movie catalog badge codes `P`, `K`, `T13`, `T16`, `T18`; the legacy schema's illustrative C-prefixed labels are not introduced as new wire values. This is a UI list, not a change to the backend enum or validation contract.
- Request retains `ageRating` as one string, e.g. `"T16"`. No API, database, dependency or routing changes. No integration blocker for this UI change.
- Targeted feature ESLint and client production build pass (existing bundle-size warning). Browser check with temporary local fixture: missing rating blocks submission and focuses the select, T13 → T16 leaves exactly one selected option, the actual create-body parser accepts the payload, creation succeeds and the form resets. Captured requests confirm no POST for the missing-rating attempt and exactly one successful POST with string `ageRating: "T16"`. Temporary QA server/file removed after verification.
