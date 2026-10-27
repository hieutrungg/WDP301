# REV-101 — Read reviews

Later integration note (2026-10-27): Hiếu subsequently approved REV-102's create-only rules and technical proposal. The historical REV-102 blocker statements in this note describe the REV-101 handoff, not current readiness. See `REV-102-IMPLEMENTATION.md` for the real posting form, write contract and pending development-Atlas index rollout. REV-101's public read API, five-star display and legacy-data protection are retained.

## Status and approvals

Implemented in the working tree, 2026-10-27. Hiếu explicitly approved the read business rules, then the proposed read contract and malformed-data handling, and finally requested “Triển khai luôn UI và API”. These approvals apply only to REV-101. REV-102 eligibility, time of submission and uniqueness remain blocked; no write endpoint, form, moderation screen or reward feature was added.

Reviewed: AGENTS.md, PROJECT_CONVENTIONS, REQUIREMENTS_STATUS, movie-exploration design, SCREEN_FLOW and its drawio discovery/customer flow, connected SRS UC11/12/13, current tracking REV-101/102, original Team Development Plan fetch, and Stitch project 12758682447811659045. Stitch canvas confirms C02, C18 and C18b exist, but C02/C18 full preview inspection was limited by browser iframe coordinates. This implementation uses the inspected F-Cinema color/type system, existing Movie Detail layout and the owner-approved local preview; it does not claim to reproduce an uninspected C02 review layout.

SRS UC12's old empty copy is superseded by “No reviews yet”. The older SCREEN_FLOW statement about reviews after showtime completion concerns posting and does not restrict public reads. C18/C18b's posting/reward features remain excluded. No SRS or task-board status was edited.

## API contract — approved for this read scope

Public `GET /api/movies/:movieId/reviews?page=1`. Guest and signed-in readers use the same endpoint. `page` is an optional positive base-10 integer string, default 1, bounded so offset arithmetic remains a safe integer. Unknown/repeated query fields are rejected; `limit`, sort and visibility overrides are not accepted. Fixed page size 10. Ordering: `createdAt DESC, _id DESC`. Offset pagination provides deterministic ties, not a snapshot across requests when new reviews arrive.

Response shape:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

Each `data` entry allowlists exactly `id` (review ObjectId string), `authorDisplayName` (Account `profile.fullName`), `rating` (integer number 1–5), `content` (unchanged string; absent content maps to empty string), `createdAt` (ISO UTC). No account ID, username, email, phone, profile, permission, internal review document, average or rating histogram is returned. `total` is pagination metadata only. Page beyond the last returns an empty array without clamping the requested page.

Errors use the existing envelope `{ success: false, code?, message, errors }`:

- 400 `INVALID_MOVIE_ID`: invalid ObjectId syntax.
- 400 `INVALID_QUERY`: invalid or unsupported query.
- 404 `MOVIE_NOT_FOUND`: nonexistent, DRAFT or ARCHIVED Movie, reusing Movie's public service.
- 500 generic `Internal server error`, no new public error code: database failure or legacy data issue. Internal logs contain a generic data-review message, without account/review contents. UI shows “Couldn't load reviews” and retry.

Query validation runs before Movie lookup if both query and ID are malformed. There are no review POST/PATCH/DELETE handlers.

## Persistence and legacy visibility

Read-only Atlas inspection on 2026-10-27: existing `movie_reviews`, **0 documents**, permissive existing validator, only `_id_` index. The documented `{movieId, customerAccountId}` unique index is not installed. No hidden/rejected records or invalid ratings were found because the collection is empty. This is an observation at inspection time, not an approval to republish legacy data later.

The adapter reads the existing collection through the native MongoDB driver supplied by Mongoose; there is deliberately no new Review model that might auto-create a collection or indexes. Mongo owns Movie filtering, sorting, count and pagination using one aggregation with facets. Account's exported `getPublicAuthorNames` read contract selects only `_id` and `profile.fullName`, batch loading authors for the current page; Movie never imports the Account model directly.

Before mapping a page, service checks numeric integer rating 1–5, valid author reference, valid date, optional string content and canonical stored field names. BSON numeric values are converted to numbers only after checking numeric BSON type. Numeric strings, missing rating, zero, fractional/out-of-range ratings, null content, missing author/name/date and unknown stored fields fail the entire requested page. No substitution, clamping, silent skipping, fallback username, backfill or record repair occurs.

Canonical storage fields are `_id`, `movieId`, `customerAccountId`, `rating`, `content`, `createdAt`, `updatedAt`, plus Mongoose's internal `__v`. Any other field (including status, moderation, hidden, deleted or privacy fields) blocks that page for owner review; it is not discarded before visibility checking. There is no new persisted PUBLIC/PENDING status. Future writers must coordinate any new storage fields before integration. Successful new submissions being immediately public is an approved business direction, not authorization to implement posting here.

**DB changes: none.** No Atlas writes, migration/backfill/seed, validator, relationship or index change. Existing `_id_` alone may require scanning/sorting at scale; benchmark and propose a compound read index separately before applying one. Current zero-record collection does not justify an unapproved deployment mutation.

## UI behavior

Movie Detail mounts a review section after the story/cast section. Theme follows current F-Cinema surfaces, red accent, yellow filled stars and gray remaining stars. Each entry has display name, exactly five noninteractive stars with an accessible `N out of 5 stars` label, optional unchanged content and a semantic date formatted in English in Asia/Ho_Chi_Minh. No visible numeric rating, half star, average, total-review statistic or posting CTA.

Loading skeletons, scoped error/retry, “No reviews yet”, Previous/Next with boundary disabling and current page label are implemented. An empty later page still permits going back after concurrent data changes. API totals only control navigation. Review content is React-escaped and whitespace preserved. Names and long unbroken content wrap; controls have minimum 44px height, native keyboard behavior and visible focus outlines; motion respects reduced-motion preference.

The feature uses the existing `httpClient` and the local Movie custom-hook convention. Request identity includes Movie ID, page and retry version; changed requests expose no prior response, cleanup aborts and ignores even late promise completions, and the Movie-keyed section resets pagination on Movie change. Review error does not replace working movie details.

## Changed files and ownership

- `server/src/modules/account/public-author.service.js`: bounded internal public-author projection; Account/RBAC owner Cường reviews, consumer Movie/Hiếu.
- `server/src/modules/movie/movie-review.{repository,validation,service,controller}.js`: existing-collection reader, approved pagination/DTO/data checks.
- `server/src/modules/movie/movie.routes.js`: additive public route; shared Movie router integration review by Hiếu and affected backend reviewer.
- `client/src/features/movie-showtime/api/movieReviewApi.js`, `hooks/useMovieReviews.js`, `components/ReviewStars.jsx`, `components/MovieReviews.jsx`: API, request lifecycle, accessible list and stars.
- `client/src/pages/public/MovieDetailPage.jsx`: scoped section integration.
- `server/test/movie-review.test.js`, `server/test/movie-review.mongo.test.js`, `client/test/movie-reviews.test.js`: read contract, real Mongo/HTTP and SSR component checks.
- `client/test/fixtures/movie-reviews-preview.mjs`: isolated in-memory browser QA harness; never imported by product routes and never contacts MongoDB.
- `docs/REQUIREMENTS_STATUS.md`: explicitly records owner's narrow read approval; original posting blocker preserved.
- This implementation note.

API owner/provider and frontend consumer: Hiếu. Internal Account display-name contract reviewer: Cường. Migration impact: none. Exact read API business contract: owner-approved in chat. Shared-file and Account boundary integration review still required before merge; no commit, push or sheet “Done”. Movie lifecycle, Booking, Payment, Ticket and Inventory runtime modules are unchanged.

## Verification

Verification results are recorded below after running checks. Test documents exist only in unique `rev101_test_<24 hex>` databases. Cleanup checks exact connected DB name plus the test prefix before dropping; connection closure runs even on cleanup failure. No configured development database is used for test mutations.

Initial Mongo test failed because the Atlas tier limits database names to 38 bytes; the original longer test name was rejected. The test now uses a 36-byte unique name and guarded cleanup. Initial SSR assertions also matched numeric text inside SVG paths/CSS; assertions now inspect visible text for numeric score/statistics instead.

No runtime data is manufactured to fill an empty review section. Test-only records are isolated fixtures, never seeded into development.

Final results:

- `server`: `node --test test/movie.test.js test/movie-review.test.js test/movie-review.mongo.test.js` — **22 passed, 0 failed, 0 skipped**, including real Atlas-backed isolated-database HTTP tests. Expected generic data-review logs come from deliberate malformed/hidden-record cases. Exact Decimal128 validation also rejects fractions that JS number conversion would round to an integer.
- `client`: `node --test test/movie-reviews.test.js` — **4 passed, 0 failed**. SSR checks all five rating values, invalid values, accessibility labels, absence of visible numeric ratings, HTML escaping/unchanged language, English/cinema date, loading/error/empty and pagination without aggregate totals.
- `server`: `npm run lint` — passed.
- `client`: ESLint on all changed production JS/JSX files — passed.
- `client`: `npm run build` — passed, existing bundle-size warning (main JS roughly 1.13 MB minified).
- Full `client npm run lint` — failed outside this scope at `ManagerShowtimesPage.jsx:115`, `react-hooks/immutability` (`nextColor` reassignment), plus exhaustive-deps warning at line 813. That file is unchanged.
- Full `client node --test test/*.test.js` — failed on existing `INT-FE-001 Staff menu mounts only inside the Staff role shell`: test expects `Concession Menu`, while unchanged Counter POS renders `Sell Concessions`. REV-101 tests passed in this run. Concurrent Vite QA/test servers also reported HMR port 24678 occupied; the temporary QA server was stopped after browser checks. The unrelated assertion was not edited to make the suite green.
- `git diff --check` — passed.

Browser QA used the real feature components/hook/API client against the committed in-memory fixture, not Atlas writes. Observed desktop and **320px** viewport: no horizontal overflow despite unbroken long text; every star group has five SVG stars and its accessible rating name; Previous/Next are 44px tall. Page 1 has ten records, page 2 has two, proper disabled boundaries; loading hides prior-page content. Starting delayed page 2 then switching Movie A to B shows only B even after A's delayed response; Movie change resets page. Error/retry succeeds and empty shows the exact approved copy. User HTML is visible as text. A screen-reader audit and broader device/browser matrix were not run.

## Remaining integration notes / blockers

REV-101 implementation is complete for the approved read scope; no read contract awaits owner approval. Development collection currently has no reviews, so the real UI correctly shows empty until a separately approved writer supplies valid records. Do not seed example reviews to demonstrate the screen. Unknown-field/legacy-data failures require an owner decision before publication or remediation; none were present at inspection.

Shared Movie router, narrow Account display-name export and requirement-approval record need normal cross-owner review before merge. Global client lint and the unrelated Staff test prevent claiming a fully green repository. REV-102, index rollout, migration and any legacy repair remain excluded. No unrelated changes, external review services, new dependencies, SRS edits, commits or pushes were made.
