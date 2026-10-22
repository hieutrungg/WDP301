# MOV-103 — Archive Movie

## Scope, approval and sources

Initial branch `movie`, initial working tree clean. Read AGENTS.md, PROJECT_CONVENTIONS, REQUIREMENTS_STATUS, SRS Group 5 UC16 §3.2.8 (plus UC17/18 and BR13/44), detailed movie design, SCREEN_FLOW §4 and Manager draw.io, MOV-102 implementation, and current connected tracking documents.

Current `WDP301_G5_Project_Tracking` → `Iter3` contains MOV-103 (owner Hiếu, To Do, APPROVED_READY). `F-Cinema — Team Development Plan` Task Board only contains MOV-001..005; its API & Data Contracts registry has no Movie archive command. Module Ownership and Requirement Decisions were read, including DEC-002 and DEC-031..033. Neither tracking sheet was modified.

Stitch project 12758682447811659045 initially failed to load. On the owner's follow-up on 2026-10-22, it loaded successfully. Read the Movie Management and Archive Movie Confirmation Modal designs and their original screen prompts; inspected the selected archive design with Zoom to Selection. The modal was then aligned to the reference: warning header, poster/real movie summary/current status, separate impact notice, crimson blocked panel, locked action, Cancel/ESC footer and Showtimes navigation. The implementation does not invent dependency totals, mock production data, refund actions or restoration. See the follow-up comparison below for deliberate differences.

The owner explicitly approved the detailed archive matrix in this conversation on 2026-10-22. No SRS changes. REQUIREMENTS_STATUS records that actual approval and integration review needs.

## Archive matrix

The following applies to every referencing Showtime. Any blocker prevents the entire archive operation.

| Reference | Result | Source |
| --- | --- | --- |
| No Showtime references | Allow | UC16 precondition; owner-approved scope |
| DRAFT/PUBLISHED, valid interval, endAt > check time | Block (upcoming or running) | UC16 + owner clarification 2026-10-22 |
| DRAFT/PUBLISHED, valid interval, endAt <= check time | Allow; preserve history | UC16 historical references + owner clarification |
| CANCELLED, any time (even missing timing) | Does not block | Owner clarification; cancellation is terminal under A-28/DEC-033 |
| Unknown/missing status | Block for data review | Owner-approved fail-closed legacy handling |
| DRAFT/PUBLISHED, missing/non-date/invalid/equal/reversed start/end | Block for data review | Owner-approved fail-closed legacy handling |
| Legacy startTime/endTime BSON dates | Same matrix; fallback only when corresponding current field is null/missing | Existing Showtime read convention + owner clarification |

The stored endAt includes configured cleanup under A-27/DEC-032. No interval is recalculated from mutable Movie duration. At startAt == now the session is running; at endAt == now it has ended. A present but malformed current field is not silently replaced with a legacy value. No string-date coercion or unknown-status interpretation is invented.

MOV-102's `hasMovieReferences` remains unchanged: every reference locks duration, even completed/cancelled references. Archive uses a separate Showtime-owned read contract.

## API contract for review

Owner: Movie / Hiếu / MEMBER_1. Consumer: Manager Movie catalog. Additive endpoint authorized by this task; exact wire contract and shared service integration remain **NEEDS_REVIEW before merge**.

`POST /api/movies/:id/archive`

- Auth: existing HTTP-only access cookie; `requireAuth`, current `movie.archive` grant, `requireRole("MANAGER")`. Direct and role grants retain union semantics; revocations/account locks apply next protected request.
- Params: Mongo ObjectId. Body absent or `{}` only; no query parameters. Reject status/internal fields, arrays and null. No arbitrary lifecycle PATCH.
- Success: HTTP 200 `{ "success": true, "data": MovieManagementDto }`, existing fields plus updatedAt, with status ARCHIVED. Does not add fields to public DTOs.
- Errors: 400 INVALID_MOVIE_ID or INVALID_MOVIE_INPUT; 401 unauthenticated; 403 FORBIDDEN / existing account-state error; 404 MOVIE_NOT_FOUND; 409 INVALID_MOVIE_INPUT for Showtime conflict; unexpected infrastructure errors use existing 500 envelope.
- Conflict details: existing `errors` array with entries `{ field: "showtimes", id: "<showtimeId>", message: "Upcoming showtime" | "Running showtime" | data-review explanation }`. UI displays returned IDs/explanations. No fabricated counts or room names.
- Repeating archive returns 200 current archived DTO. Sequential retries do not write, change updatedAt or alter __v. Concurrent retries converge on one business transition and the same updatedAt; contended transactions can advance the existing internal __v guard, never duplicate business effects.

Example conflict:

```json
{"success":false,"code":"INVALID_MOVIE_INPUT","message":"Movie cannot be archived until its showtime dependencies are resolved","errors":[{"field":"showtimes","id":"<actual-showtime-id>","message":"Upcoming showtime"}]}
```

No new enum, permission, collection, index, relationship or schema field. Archive sets status and normal updatedAt only; uses existing __v transaction guard internally. Preserves ID, releaseYear, title/year uniqueness, metadata and references. MOV-101's already documented unique-index migration remains a prerequisite; no development migration/seed/cleanup was run.

## Integration and concurrency

Movie service reloads under `movieRepository.withSchedulingLock`, calls Showtime's exported `getMovieArchiveBlockers(movieId, now, session)`, then writes ARCHIVED in that session. The check occurs at confirmation/write time, not modal open. No eligibility read writes Last Modified. Exceptions roll back status and guard writes.

The existing Showtime create flow inserts DRAFT while holding the same Movie guard. If creation wins first, archive sees DRAFT/PUBLISHED and returns 409. If archive wins first, the scheduling guard reloads ARCHIVED and refuses creation. No new cross-module internal-model imports. Existing reschedule only accepts upcoming PUBLISHED sessions (which already block archive); CANCELLED is terminal. Import/seed/direct DB writers must remain offline or follow the guard protocol, as in MOV-102.

MongoDB replica set or sharded transaction support is mandatory. There is no standalone check-then-write fallback. Showtime insertion/publication and existing seat initialization are unchanged. No Showtime end/status/snapshot, Booking, Payment or Ticket is rewritten by archive.

Shared read contract owner: Showtime / Đạt / MEMBER_3; consumer: Movie archive service. Existing scheduling guard owner: Movie; consumer: Showtime creator. Migration impact: none beyond transaction deployment prerequisite already introduced by MOV-102. Business approval: approved by owner; exact cross-module/API integration needs Movie/Showtime/RBAC review before merge.

## Manager UI

`/manager/movies` reuses the existing catalog, search, page and feature API client. Catalog/detail still require movie.update and MANAGER. Archive action additionally requires movie.archive; an archive-only Manager can call the command but does not gain catalog/detail access. No router/layout permission expansion.

Native dialog provides focus containment, Escape handling, title/description and the actual movie title. Cancel/close/Escape before submitting send no request and announce no success. While submitting, all modal actions are disabled and an immediate ref guard prevents duplicate handlers. 401/403/404 prevent retry in the same dialog; 409 and 5xx retain the modal and show the error without changing displayed Movie status. A dependency conflict additionally locks Archive with a padlock, lists actual returned dependencies and provides a Showtimes link; close/reopen after resolving dependencies to retry. 5xx remains retryable. Success closes the modal, announces the archived title and refetches the catalog with the same search/page. Archived Movies remain in management, lose the Archive action and are excluded by existing published-only public Movie/Showtime discovery.

## Verification

Manual browser fixture uses the actual routed frontend with all /api traffic intercepted by an in-memory loopback server; it does not substitute for the separate real Mongo/HTTP authorization and persistence tests.

- Backend combined command in `server`: `node --test --test-concurrency=1 test/movie-archive.test.js test/movie-archive.mongo.test.js test/movie-create.test.js test/movie-create.mongo.test.js test/movie-update.test.js test/movie-update.mongo.test.js test/movie.test.js test/ticket-pricing.test.js test/showtime-merge-integration.test.js`. First run: **62 pass, 2 fail, 0 skipped**. Both failures were DNS SRV `ETIMEOUT` before connecting (MOV-103 and MOV-101 Mongo suites), not assertion failures. MOV-102 real Mongo regression, including duration/creation concurrency, passed **14/14** in this run.
- Reran only the failed suites after connectivity recovered: `node --test --test-concurrency=1 test/movie-archive.mongo.test.js` → **8/8 pass, 0 skipped**; `node --test --test-concurrency=1 test/movie-create.mongo.test.js` → **9/9 pass, 0 skipped**. Across the original passing tests and these reruns, all **79 distinct tests** passed. No claim of a single clean 79/79 combined run.
- MOV-103 real Mongo/HTTP coverage: current RBAC/direct grant/role revocation/account locking, archive-only read denial, strict ID/body/query checks, DRAFT/PUBLISHED/archive idempotence, status/time/legacy matrix, rollback on conflict, preservation of Movie metadata and synthetic historical Showtime/Booking/Payment/Ticket/ShowtimeSeat snapshots, archived uniqueness, concurrent duplicate archive, and both transaction orderings against the actual Showtime creator/repositories. The concurrency test observes the competing Mongo guard command before releasing the first transaction. Only Room/pricing/seat initialization dependencies are fixture adapters; Movie/Showtime persistence and transactions are real. Fresh task-specific test databases were cleaned in finally, never development data.
- Client `node --test test/movie-form.test.js test/movie-search-params.test.js` → **15/15 pass** (MOV-101/102 helpers and public search/navigation regression).
- Scoped backend ESLint (Movie module, Showtime reference service, both archive suites): **pass**. Scoped client ESLint (manager-movies feature + archive QA fixture): **pass**. `git diff --check`: **pass**. Client `npm run build`: **pass**, existing >500 kB chunk warning remains.
- Full client lint was run during this task and still fails at untouched `ManagerShowtimesPage.jsx:106` (`react-hooks/immutability`), with the existing dependency warning at line 383. This matches the MOV-102 baseline and was not hidden by unrelated edits. Existing Showtime publication emits the Mongoose `new` option deprecation warning during integration tests.
- Manual browser QA: actual title/consequences, Cancel with zero POST, X/Escape with zero POST, loading and disabled actions, success/refetch to ARCHIVED while preserving `q=MOV&page=1`, removed action for archived Movie, conflict with returned dependency ID, 403/404 with disabled retry, 500 with retry available, and hidden Archive action without permission. A double-click on Confirm yielded **exactly one POST**, followed by ARCHIVED. Failure scenarios kept Movie PUBLISHED and showed no success message. Desktop modal layout inspected; success screenshot saved as `client/test/fixtures/movie-archive-success.png`. Fixture server/tab were stopped after QA.
- Initial limitation (resolved by the follow-up below): live Stitch visual comparison could not initially run because the embedded project app failed to load. No standalone Mongo test, production deployment test, or external blackbox sign-off is claimed. Owner will perform final review/blackbox testing.

## Stitch comparison follow-up — 2026-10-22

Source: [Stitch project](https://stitch.withgoogle.com/projects/12758682447811659045), screens **Movie Management — F-Cinema Executive Portal** and **Archive Movie Confirmation Modal — F-Cinema Executive Portal**.

| Reference | Follow-up implementation / boundary |
| --- | --- |
| Warning header, confirmation subtitle, dark blurred backdrop, bordered summary panel | Applied within the existing theme; responsive maximum-width modal |
| Poster, title and current status requested in the original Stitch prompt | Uses actual posterUrl with image-error fallback, title, status, duration, rating, release year and actual ObjectId |
| Disabled Archive with lock when dependencies exist | Applied after authoritative backend conflict; no new advisory API or fake precheck. Every attempted write still rechecks in a transaction |
| Highlighted dependency panel + Showtimes shortcut | Uses actual returned dependency IDs/messages; links to the existing Manager Showtimes page |
| Archive Movie / Cancel with ESC | Applied; retains close/Escape/loading/duplicate-submit protections |
| Example studio/format/run-expiry fields, 94 showtimes, 5 branches, 1,420 sold tickets | Not copied: absent from the approved Movie/response contracts. No mock production metrics |
| Emergency de-listing, reassignment, permanent audit-ledger claim | Not copied: these are not implemented/approved business capabilities |
| Full desktop Movie Management table, status/genre/rating filters, export/sync/KPIs | Existing MOV-102 card catalog/search/pagination retained. Full catalog redesign is outside this modal follow-up; no new filter contract or lifecycle labels invented |

Changed in this follow-up: ArchiveMovieModal.jsx, test-only movie-archive-preview.mjs (local poster fixture), this report and new client/test/fixtures/movie-archive-stitch-review.png. API/DB/shared contracts unchanged. The fixture's image is an existing local asset used only to test successful image loading; production uses the Movie's own posterUrl.

Follow-up verification: scoped client ESLint and production build **pass** (existing chunk-size warning remains). Actual browser verified a loaded poster, the absent/broken-poster fallback, current status/metadata, Cancel/X/Escape with **zero POST**, backend conflict with disabled padlock action and actual dependency ID, and successful double-click submission with **one POST** and refetch to ARCHIVED while retaining search/page. The 403 flow still displays the permission error and disables submission. At 1280×720, the blocked modal stays within 90dvh and its fixed footer/Archive action remains visible; the content scrolls independently. No new backend changes/tests in this UI-only follow-up; previous backend verification remains recorded above. Fixture server and QA tab stopped after verification. The remaining intentional visual gap is the existing card catalog versus Stitch's full table/filter dashboard; no claim of whole-page pixel parity.

## Blackbox checklist

Use a separate test database with transaction support. Do not prepare these cases by deleting or migrating development data. Use synthetic titles/identities only. Run backend from `server` (`npm run dev`) and client from `client` (`npm run dev`) with the project's normal local API configuration.

Accounts: (A) ACTIVE MANAGER with movie.update + movie.archive; (B) MANAGER with movie.update only; (C) non-Manager with movie.archive; (D) MANAGER with only movie.archive for API/read-boundary checks. No credentials are supplied or changed by this task.

Prepare distinct Movies: no references; past-only DRAFT/PUBLISHED Showtimes; future/running DRAFT/PUBLISHED; future CANCELLED; valid legacy dates; malformed/missing interval/status. Keep copies of historical Showtime/booking/payment/ticket/seat documents for comparison. Historical/legacy cases require isolated test fixtures, since normal creation deliberately rejects past starts.

| Steps | Expected UI / HTTP / data |
| --- | --- |
| A opens catalog, searches, opens Archive for an eligible Movie | Correct real title/consequences; no POST until confirmation |
| Cancel, reopen and close with X, reopen and press Escape | No archive POST, no success message, original status/data |
| Confirm eligible Movie; double-click or press Enter repeatedly while pending | Processing label and disabled buttons; one request; 200; ARCHIVED after refetch; search/page preserved |
| Read archived Movie through management and public endpoints | Management 200 ARCHIVED, public Movie detail 404 and public list excludes it; existing Showtime discovery filters archived Movie |
| Repeat the same POST with `{}` | 200 ARCHIVED; ID/updatedAt/history unchanged on sequential repeat |
| Archive past-only history | 200; original history/snapshots/relationships unchanged; title/releaseYear still reserved by unique index |
| Archive future/running DRAFT/PUBLISHED, including cleanup window | 409 INVALID_MOVIE_INPUT; returned dependency IDs visible; modal stays; Movie remains unchanged |
| Archive only future CANCELLED references | 200; cancelled Showtime is preserved |
| Archive unknown status or unreadable interval | 409 with data-review explanation; no automatic data repair |
| B opens catalog | No Archive action; direct POST returns 403 |
| C sends direct POST; anonymous sends POST | 403 for wrong actor; 401 anonymous |
| D calls management reads then archive command | Management reads 403; eligible archive command 200; no read permission expansion |
| Open modal with A, revoke grant or lock account before Confirm | Next request 403; no success/optimistic ARCHIVED |
| Use invalid ID, then valid nonexistent ID | 400 INVALID_MOVIE_ID, then 404 MOVIE_NOT_FOUND |
| Force 404/500/network failure on confirm in test environment | Error visible; no false success; 404 disables retry; 5xx allows retry or close |
| Send body containing status/releaseYear/force or a query parameter | 400 INVALID_MOVIE_INPUT; no mutation |
| Race archive and create Showtime for same Movie | Both cannot succeed: creation wins → archive 409; archive wins → creation rejected; no new Showtime for archived Movie |
| Recheck MOV-101/102 | Archived title/year duplicate still rejected; duration remains locked for any reference; independent metadata remains editable |

For deterministic UI-only QA: in `client`, run `node test/fixtures/movie-archive-preview.mjs --serve`; open `http://127.0.0.1:5176/manager/movies?q=MOV&page=1`. Fixture scenarios are switched using the local `/__fixture/scenario/<success|conflict|forbidden|missing|failure|no-grant>` endpoint, then reload. `/__fixture` lists requests to verify Cancel and one-submit behavior. This test-only file is not imported by the application or production build.

## Changed files

- Backend Movie: movie.routes.js, movie.controller.js, movie.validation.js, movie.service.js, movie.repository.js.
- Showtime: showtime-reference.service.js (additive read/policy; duration reference contract retained).
- Client: managerMovieApi.js, ManagerMoviesPage.jsx, new ArchiveMovieModal.jsx.
- Tests: new server/test/movie-archive.test.js, movie-archive.mongo.test.js; client/test/fixtures/movie-archive-preview.mjs and movie-archive-success.png.
- Documentation: REQUIREMENTS_STATUS.md (actual owner clarification), this report.

No dependencies, package files, app.js, router/layouts, schema/index files or SRS changed. No commit, push, PR or task-status change.
