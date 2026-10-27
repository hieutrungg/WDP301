# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git: never commit or push on your own

**Không được tự ý commit hoặc push code.** Do not run `git commit`, `git push`, `git merge`, `git rebase`, `git reset --hard`, or create or merge PRs unless the user explicitly asks for that specific action in the current turn. Leave changes in the working tree for the user to review. Earlier approval does not carry over to later changes. Also do not update the Google Sheet task board or mark tasks Done. Every implementation report in `docs/*-IMPLEMENTATION.md` ends by stating that no commit, push, merge or sheet update was made, so follow the same practice.

Git flow (A-10): `main` <- `develop` <- `feature/*`. Never push to `main`.

## Governance first

`AGENTS.md` holds the mandatory team rules (read-before-edit checklist, forbidden changes, the required post-task report). Follow it. In short:

- `docs/PROJECT_CONVENTIONS.md` is the engineering source of truth. Section 21 lists the approved decisions A-01 to A-29 (A-29 is the refund demo policy). Anything an AI proposes stays `PROPOSED` until the owner approves it. Approvals given in chat are recorded in `docs/REQUIREMENTS_STATUS.md` ("Approval queue") or in the task's implementation doc.
- `docs/REQUIREMENTS_STATUS.md` gives each use case's readiness. Do not implement anything marked `BLOCKED_BY_DECISION`; record the blocker there or on the task board instead.
- Business rules come from the SRS and approved decisions. Navigation comes from `docs/SCREEN_FLOW.md` and `docs/screen-flow.drawio`. Visuals come from Stitch project `12758682447811659045`; local exports are in `docs/screens/*`. Per-feature designs are in `docs/3-detailed-design/`.
- Shared files need cross-review: `server/src/app.js`, the client router and layouts, lockfiles, shared constants and error middleware, DB validators, indexes and seeds, and the governance docs.
- Do not edit governance docs to make code look compliant. Do not add large dependencies without approval. Do not bring in TypeScript, Redis, queues, GraphQL or microservices.

### Team ownership (`docs/TEAM_ASSIGNMENT.md`)

Each member owns their modules end to end. Do not edit another owner's module without saying so, and name the reviewer in the report.

| Member | Owns |
| --- | --- |
| Hiếu | Movie, public Movie UI, Concession catalog/checkout UI, frontend router integration |
| Nam | CinemaBranch, Room, physical seat layout, Inventory |
| Đạt | Showtime, Reports/Analytics |
| Hà | Booking, SeatHold, seat availability |
| Cường | Auth, Account, RBAC, Payment, Ticket, shared API/error foundation, backend integration review |

The actual owner sometimes differs from this table: for example, BOOK-010 and E2E-001 list Hiếu as owner. Check the task's implementation doc for its real owner and reviewers.

### Where to find things in `docs/`

- `*-IMPLEMENTATION.md` (MOV-101..103, CON-101/102, BOOK-010, INT-FE-001, E2E-001, REF-101-105, COUNTER-CONCESSION-POS, CONCESSION-UI): per-task reports with the exact API/DB contracts, changed files and verification. Read the ones for any module you touch. They are the de facto contract history.
- `CON-102-INTEGRATION-CONTRACT.md`: the approved Booking + optional F&B + Payment contract (amounts, quote, checkout-cancel vs payment-attempt-cancel, error codes).
- `3-detailed-design/seat-hold.md` (BOOK-001 contract) and `checkout-flow.md` (FLOW-002, including the Booking→Payment handoff fields). The other `3-detailed-design/*.md`, `1.1-software-architecture.md`, `1.2-package-diagram.md`, `DESIGN-REVIEW-SUMMARY.md`, `SDS-G5-V1-DESIGN-ANALYSIS.md` and `PROJECT_STRUCTURE.md` are **proposals** (full Clean/Hexagonal layout, folders that don't exist). Don't restructure code to match them.
- `cinema_database_schema.md`: collection/field reference. `Cinema_Management_System_Business_Rules.md`: BR-01..BR-53. `CMS_UC*.md`: per-use-case specs for UC38–41.
- `docs/screens/*/code.html` + `screen.png`: Stitch exports. Every `DESIGN*.md` there is the same "Blockbuster Cinema Experience" design-token file (dark surface, `#e50914` primary).
- `REPOSITORY_AUDIT.md` (2026-10-07) is a historical snapshot. Much of its "missing" list has since been built.

## Commands

The repo has no root `package.json`. `client/` and `server/` are separate npm projects (Node 20.19+ / 22.12+). Install each with `npm ci`.

Server (`cd server`):

```bash
npm run dev            # nodemon src/server.js on :5000 (needs server/.env)
npm run lint           # eslint src test
npm test               # node --test --test-concurrency=1 (all of server/test)
node --test test/payment.test.js                 # single file
node --test --test-name-pattern="idempotent" test/payment.test.js   # single test
npm run seed:dev       # idempotent dev seed (movies, branches, rooms, seat holds, inventory)
node src/migrations/<file>.js                    # versioned migrations, run against MONGODB_URI
```

Client (`cd client`):

```bash
npm run dev            # Vite on :5173
npm run lint
npm run build
node --test test/                    # client unit tests (no npm script exists for this)
node --test test/seat-pricing.test.js
```

Server tests come in three kinds:
- Pure unit tests with in-memory fakes (e.g. `payment.test.js`, `booking.test.js`).
- `*.e2e.test.js`, which need `MONGODB_URI` from `server/.env`. They switch to a throwaway database name (e.g. `cinema_management_register_test`) and drop it afterwards.
- `*.mongo.test.js` and the migration/seed tests, which skip unless `MONGODB_URI` or `MONGODB_TEST_URI` is set. `MONGODB_TEST_URI` must name a database containing "test".

A skipped test is not a passing test, so report skips as skips. Booking, payment, movie-update, showtime-create and concession-checkout flows use Mongo transactions, so their Mongo tests need a replica set (Atlas or a local replica set). Never point tests at the development database.

Browser E2E (E2E-001) is an opt-in runner outside `test/`: `node server/e2e/run.mjs` from the repo root. It needs a transaction-capable Mongo (`E2E_MONGODB_URI` or `server/.env` `MONGODB_URI`) and an existing Playwright install (`E2E_PLAYWRIGHT_MODULE=<abs path to playwright/index.mjs>`, optional `E2E_BROWSER_CHANNEL=msedge`, `E2E_CASE='02'` to run one case). It creates and drops its own `fcinema_e2e_*` database. Playwright is not a project dependency. See `docs/E2E-001-IMPLEMENTATION.md`.

Database bootstrap uses mongosh. Run `docs/ref/cinema_management_empty_db/create_empty_db.js` and `create_indexes.js` for collections, validators and indexes, then `docs/ref/seedDataRegister.js` for roles and permissions. All three hard-code the `cinema_management` database. Several models set `autoIndex: false` (booking, payment, combo), so their indexes only exist after the matching migration in `server/src/migrations/` runs. See `docs/Setup.md`.

## Architecture

The app is a modular monolith (Express 5 + Mongoose, ESM) with a React 19 + Vite SPA. Auth uses a JWT access token in the HTTP-only cookie `accessToken`. The client's Axios instance (`client/src/lib/api/httpClient.js`) sends `withCredentials`, and its base URL comes from `VITE_API_BASE_URL`.

### Backend (`server/src`)

- `app.js` mounts every module router under `/api`. Some routers mount at `/api` itself (showtime, concession) and define their own sub-paths.
- Each module lives in `modules/<module>/` with `routes → controller → service → (repository) → model` files, plus `*.validation.js` (zod) and `*.constants.js` (enums owned by the module). Controllers hold no business rules and never call Mongoose. Errors reach `errorMiddleware` via `next(error)`.
- Cross-module access goes through exported service or read functions, never another module's model or repository. Transactional modules take this further: `booking.module.js`, `payment.module.js`, `refund.module.js` and `concession/counter-checkout.module.js` are composition roots. They build services with factory functions (`createXService({ ports... })`) and inject ports such as `showtimeReader`, `roomLayoutReader`, `seatHoldPort`, `bookingService`, the mock payment `gateway` and the mock refund `provider`. Tests use the same factories with in-memory fakes. Follow this pattern for modules with concurrency or external providers.
- Payment calls Booking only through its internal `confirmBookingAfterVerifiedPayment` port. No HTTP endpoint confirms a Booking directly. Online F&B (`/api/concession-checkout`) joins the same Booking/SeatHold transaction via the Concession and Inventory owner ports. Walk-in counter F&B (`/api/counter-concessions`) creates an Order-first Payment with no Booking.
- Tickets (`modules/ticket`, TICKET-001): Payment calls `ticketPort.issueTicketsForConfirmedBooking` only after the PAID settlement is persisted, one ticket per seat, idempotent through the unique `(bookingId, seatId)` index (migration `20261027-ticket-001-indexes.js`; issuance fails closed without it). Payment detail reads re-issue missing tickets for `CONFIRMED` + `PAID` bookings. Other modules use `getCheckInStatusByBooking` / `invalidateTicketsByBooking`. Refund is not wired to these ports yet and still assumes `checkedIn: false`. QR is drawn by the demo `MockQrSvg` renderer (not a scannable QR). See `docs/TICKET-001-IMPLEMENTATION.md` and `docs/PAY-001-IMPLEMENTATION.md`.
- Code style: the backend uses double quotes and semicolons. The frontend uses single quotes and no semicolons.
- Protected routes chain `requireAuth` (`middlewares/authMiddleware.js`, sets `req.auth.accountId`), then `requirePermission("x.y")` and/or `requireRole("ROLE")` (`middlewares/permissionMiddleware.js`). Both reload the account on each request, so a lock or revocation takes effect immediately. Effective permissions are the union of role grants and `directPermissionIds`.
- `validate(schema, { source })` puts parsed query/params on `req.validated[source]`, because Express 5's `req.query` is read-only. The body replaces `req.body`.
- Errors use `AppError(statusCode, message, errors, code)`. New APIs return `{ success, data, meta }` / `{ success:false, code, message, errors }`. Keep the older auth response shapes as they are.

### Core domain invariants (approved decisions)

- A physical seat in `Room` describes layout only. Availability, holds and bookings belong to **Showtime + Seat** (`showtime_seats`, `SeatHold`). Room layouts are versioned, and a published showtime pins `roomLayoutVersion`.
- A seat hold lasts 10 minutes (configurable), at most one active hold per showtime seat. Acquiring several seats is all-or-nothing and atomic.
- Booking states are `PENDING_PAYMENT → CONFIRMED | EXPIRED`. Payment is provider-neutral and backed by a deterministic mock gateway. It is idempotent on both the provider reference and the processing key. A success that arrives after expiry becomes `REFUND_REQUIRED/REVIEW_REQUIRED` and never confirms the booking. A ticket or QR code is issued only once, after an authoritative confirmed payment.
- Showtimes persist only `DRAFT/PUBLISHED/CANCELLED`, and display states are derived. Times are stored in UTC and shown in `Asia/Ho_Chi_Minh`. `endAt` = movie duration + cleanup buffer (default 15 min), and showtimes in the same room must not overlap on `[startAt, endAt)`.
- Money is integer VND. Records with history are archived, never hard-deleted. Online and counter (POS) flows must reuse the same booking, payment and ticket services.
- Online checkout with F&B: `Booking.totalAmount = subtotal - discountAmount + concessionAmount`. The linked Order expires with the original SeatHold, and the hold is never extended. Inventory is reserved on Booking submit, consumed once on verified payment, and released on cancel or expiry.
- Refund (A-29): 45-minute cutoff before the showtime. Only a Manager approves or rejects. Digital refunds go through an idempotent mock provider, and cash is returned manually. Booking, seat and F&B are finalized only after the refund succeeds.

### Frontend (`client/src`)

- `app/router/index.jsx` defines all routes. Each role has its own shell (`PublicLayout`, `StaffLayout` at `/staff`, `ManagerLayout` at `/manager`, `AdminLayout` at `/admin`). `ProtectedRoute` checks identity and `PermissionRoute permission=… role=…` hides navigation. These are UX guards only, and the API is the security boundary.
- Feature code lives in `features/<feature>/{api,components,hooks,pages,schema,utils,store}`. Pages call hooks, hooks call the feature API, and the feature API uses `httpClient`. Shared `components/`, `lib/` and `layouts/` must not import features. Zustand holds session and small cross-route state (`features/auth/store`, `lib/store/selectedBranchStore.js`). React Query is used for server state.
- Client tests use `node:test` and only cover pure utils/schemas (checkout session, seat pricing, form schemas), so keep testable logic in `utils/` or `schema/`.
