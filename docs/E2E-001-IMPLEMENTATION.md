# E2E-001 — Public to combined checkout

Implemented 2026-10-26. Owner: Hiếu; integration reviewers: Hà (SeatHold), Đạt (discovery/pricing), Nam (Inventory), Cường (Auth/Payment/Ticket). Automated evidence is browser → real React/Vite → real Express routes/services → a disposable MongoDB database, through the application's official mock gateway. It does not use `client/test/fixtures/checkout-preview.mjs` or intercept/fulfill application API responses.

## Sources and scope

Read `AGENTS.md`, `PROJECT_CONVENTIONS.md` (including A-02/03/04/08/09 and A-14–23), `REQUIREMENTS_STATUS.md`, `SCREEN_FLOW.md`, customer nodes in `screen-flow.drawio`, BOOK-010, INT-FE-001, CON-102 implementation reports and the approved `CON-102-INTEGRATION-CONTRACT.md`. Earlier deployment statements in CON-102 are historical: the owner reports that the concession migration has since been applied to development. This task does not reconnect to that database to verify or change its rollout.

Read [SRS - G5](https://docs.google.com/document/d/116F63OfQO-ljWkpJXMsOeYsRBHitgqcDKdS0DtPfh4c/edit), UC20–23 and UC28–30. The fetched SRS calls Process Payment UC29 and Apply Voucher UC30, while historical task references use UC30 for Payment. Tests follow the existing approved implementation contract; no SRS numbering or voucher implementation was changed.

The exact title “F-Cinema — Team Development Plan” was not returned by connected Drive searches. The accessible current [WDP301_G5_Project_Tracking](https://docs.google.com/spreadsheets/d/1MAx0E_PSI7R8fHpBKPF2tsIzboB8lf9Sh1ZwwFaz4O4/edit) was read: Iter2 row 12 contains E2E-001 (`APPROVED_READY`, status To Do); Iter3 row 12 contains the approved optional F&D business flow. This accessible workbook has no Contract Registry/Requirement Decisions tabs. Those original tabs could not be reread; repository approvals/contracts and the explicit task instruction are the technical sources. No sheet was edited.

Opened Stitch project `12758682447811659045` and inspected the project canvas/runtime labels for C01/C02, C08/C09, Select Seats, C13 and C14 and the booking-history/detail reference. Full offscreen C13/C14 iframe content could not be inspected at the canvas's 5% zoom (element covered). No UI or visual-parity change is claimed by this test task.

## Prerequisites and commands

- Install the existing `server/` and `client/` dependencies with their lockfiles; use the Node version supported by the existing Vite installation.
- MongoDB must support transactions (replica set or sharded cluster). Set `E2E_MONGODB_URI`, or allow the runner to read only `MONGODB_URI` and optional `MONGODB_DNS_SERVERS` from `server/.env`. Never paste a URI into shell history or committed files.
- Provide an existing Playwright installation and Chromium browser. No new dependency or lockfile is introduced. The runner resolves `playwright` from `client/` when available; otherwise set `E2E_PLAYWRIGHT_MODULE` to an existing absolute `playwright/index.mjs`. On this machine the Codex bundled runtime supplies it. `E2E_BROWSER_CHANNEL=msedge` selects installed Microsoft Edge; omit it for Playwright's installed Chromium.

From the repository root, in PowerShell on the verified machine:

```powershell
$env:E2E_PLAYWRIGHT_MODULE = 'C:\Users\hieutr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs'
$env:E2E_BROWSER_CHANNEL = 'msedge'
node server/e2e/run.mjs
```

On another machine, replace the module path with its existing Playwright installation. If Playwright/browser is absent the runner fails explicitly; it never silently skips or installs packages. Installing a new project dependency remains subject to owner approval. An optional `E2E_CASE='02'` or comma-separated `'04,08'` runs selected numbered cases; clear it for the complete run (`Remove-Item Env:E2E_CASE -ErrorAction SilentlyContinue`). Exit code 0 means the selected cases passed. Use a complete unfiltered run for acceptance.

## Isolation, fixtures and cleanup

`run.mjs` connects Mongoose with an explicit generated `dbName=fcinema_e2e_<pid>_<random>`, independent of the URI's default database. It checks the resolved database name and transaction capability before writes. No development seed, development migration, production connection, application schema edit or public test endpoint is introduced.

The fixture creates two Customers with real password hashes and a Customer role/`booking.create` grant; published Movie; two active branches; Room/layout with stable physical seat IDs; active ticket price plan and immutable per-showtime price snapshots; future published Showtime; category, loose popcorn, free water, unavailable item, combo with shared popcorn/water components; and branch-specific inventory. All credentials are disposable and generated per fixture. Login uses the actual form and HTTP-only cookie; no injected tokens, storageState or forged session. Each scenario starts with empty test collections, preserving their indexes. Stored price-plan values are fixture values, not a change to product pricing policy.

The runner creates the existing model indexes and calls the existing concession index migration function against **only** its verified test database. It does not copy externally managed Atlas validators or production deployment configuration. It starts the exported production Express app in-process on an ephemeral loopback port, and Vite on another ephemeral port, proxying `/api` to that Express listener. Business services and persistence adapters are unchanged. No child application process is required.

All UI waits use locators, URL transitions or actual HTTP responses. Expiry is tested by a guarded fixture that ages only that checkout's persisted hold/seat/Booking/Order/reservation deadlines. The actual server then processes expiry and late callback with its normal clock. No product hold duration is reduced and no publicly accessible clock override exists. Exact equality-at-expiry is separately covered by existing backend lifecycle tests, not claimed as browser clock simulation.

`finally`, test teardown and SIGINT/SIGTERM handlers close owned browser contexts/browser, Vite and the Express listener, then drop exactly the generated test database and disconnect Mongoose. Subtest abort closes its browser context. Cleanup errors fail the run. Like any in-process cleanup, forced OS termination/power loss cannot execute a handler; an interrupted disposable database must be reviewed by its exact reported test-run identity, never by a wildcard deletion or by reusing a development seed command.

Artifacts are ignored under `.codex-tmp/e2e/<run-id>/`: JSON results, masked failure screenshot, and allowlisted network metadata (method/path/status). Screenshots mask inputs/textareas. No raw Playwright trace/HAR is retained because it contains authentication cookies and login bodies. No request headers, URI, password, token, raw API body or secrets are logged. Test-only IDs and fixture labels may appear in screenshots/metadata.

## Browser coverage

| Case | UI and durable assertions |
| --- | --- |
| 01 | Public Movie → detail → branch/date/Showtime → Guest Login → same seat-selection route; server seat price/hold; Skip; ticket-only amount; one paid Booking/Payment and sold seat; no food Order/reservation/SALE; duplicate callback; confirmation reload. |
| 02 | Locked branch menu; add/increase/decrease/remove; loose item + shared-component combo; server quote; no reservation before submission; one combined Payment; pending pickup hidden; duplicate Booking request and callback; exact summed stock deduction and one SALE/component; other-branch stock unchanged; immutable food snapshots/pickup code on confirmation and Booking History detail. |
| 03 | Food and checkout reload/back preserve selection and original expiry; independent tab, another valid Showtime, another account and same-tab identity switching cannot reuse the saved checkout; original account can recover its own saved selection. |
| 04 | Official mock decline, reload, canceled attempt and later retry; reload with a pending Payment reuses the same attempt; same pending Booking/Order/reservation and original expiry; one eventual settlement and stock deduction. |
| 05 | Cancel entire checkout; Booking/Order expire; held seat and stock reservation release; physical stock unchanged; no SALE; repeated cancel remains safe. |
| 06 | Unavailable item disabled, zero-price Special offer; shortage after server quote; no partially committed Booking; original hold survives; editing/Skip permits successful ticket-only payment. |
| 07 | Aged live checkout receives late official mock success → REVIEW_REQUIRED; Booking/Order expire, no seat sale/pickup/stock deduction; UI review state; aged pre-Booking hold rejects submission and UI expires. |
| 08 | Guest rejects protected reads/mutations; another real logged-in Customer cannot read/cancel/quote/book/settle/release the original checkout; client quote price/amount/total/branch rejected; forged Payment amount rejected; original checkout remains unchanged. Existing hold APIs hide other owners as unavailable (409), while Booking/Payment ownership operations return 403. |

This is E2E through mock Payment and the **existing demo Ticket boundary**, not certification of a real provider or issued admission Ticket/QR. Existing UI demo previews may appear only after paid confirmation. The suite checks that no real ticket document is issued by the tested successful flow. Real Ticket issuance, real gateway, refund, POS fulfillment, voucher and deployment are outside scope.

## Changed files and integration

- `server/e2e/run.mjs`: explicit browser runner, real app/Vite setup, DB/index lifecycle, safe failure artifacts.
- `server/e2e/fixture.mjs`: isolated minimal data and guarded persisted-deadline expiry fixture.
- `server/e2e/journey.mjs`: eight browser scenarios with actual API and database assertions.
- `server/eslint.config.js`: include E2E `.mjs` in the existing lint configuration.
- `server/test/booking-authorization.test.js`: supply the cancellation handler now required by the actual router in this existing create-authorization test. The initial regression run exposed its missing handler; runtime routing was correct and unchanged.
- `client/src/features/booking/pages/CheckoutPage.jsx`: fix retry after reload. Before initiating Payment, read the existing protected Booking/Payment details; reuse a same-method pending attempt's idempotency key or derive a new retry key from the preceding persisted attempt ID. This also avoids sequence gaps from earlier interrupted requests. Local sequence reset can no longer reopen the old FAILED/CANCELLED attempt as a new retry. The backend continues to authorize and verify all amounts/expiry. Case 04 is its browser regression.
- `docs/E2E-001-IMPLEMENTATION.md`: prerequisites, coverage, evidence and report.

API changes: none; the retry fix consumes an existing protected GET before the existing POST. DB/schema/relationship/index contract changes: none; existing indexes applied only to disposable databases. Dependencies/package/lockfiles: unchanged. Runtime change is limited to the approved Payment retry recovery. No SRS/governance edits, commit, push, sheet status update or merge.

Cross-owner review remains required for the existing combined checkout contract; the test suite does not constitute human review or project-level Done. Source-access limitations above remain documented; real Ticket issuance is still pending its module owner.

## Actual verification

Unfiltered real-browser run: **8/8 scenarios passed, 0 failed, 0 skipped, 0 browser scenarios blocked**. Node's reporter counts the parent as well: **9 passed**. Duration: 256.38 seconds, using Node `v24.14.1`, Edge `156.0.4314.42`. The test database was successfully dropped (`databaseDropped: true`). Evidence: `.codex-tmp/e2e/fcinema_e2e_39340_6c3bedd1b0c919b1/results.json` (local, intentionally ignored).

| Scenario | Passed | Failed | Skipped | Blocked |
| --- | --- | --- | --- | --- |
| Public/Login/Skip | 1 | 0 | 0 | 0 |
| Food/combined Payment/snapshots/idempotency | 1 | 0 | 0 | 0 |
| Reload/back/account/showtime/tab isolation | 1 | 0 | 0 | 0 |
| Failure/cancel/retry and pending-attempt recovery | 1 | 0 | 0 | 0 |
| Cancel entire checkout/release | 1 | 0 | 0 | 0 |
| Shortage recovery/Unavailable/Special offer | 1 | 0 | 0 | 0 |
| Expiry/late success/review | 1 | 0 | 0 | 0 |
| Guest/other-owner/tampering boundaries | 1 | 0 | 0 | 0 |

The full run passed after the Payment retry repair; the final retry-key refinement was also checked by a separate clean browser run of case 04 (result recorded below). Earlier iterations failed on harness assertions and exposed the actual retry defect; those failures are retained as local masked screenshots/network metadata. The final green result does not erase their history.

Final clean case-04 rerun: **1/1 scenario passed** (2/2 with parent), 0 failed/skipped, 57.64 seconds including setup/cleanup. It verifies failed-attempt reload, pending-attempt reload with the same attempt ID, cancellation, successful retry and exactly one combined settlement. Evidence: `.codex-tmp/e2e/fcinema_e2e_24144_790fe3fbd56a0889/results.json`; `databaseDropped: true`.

- Backend targeted regression after the test-fixture repair: **52 passed, 0 failed, 0 skipped**.
- Client checkout/router/login tests: **19 passed, 0 failed, 0 skipped**. These are frontend integration/unit tests, separate from the browser suite.
- Backend `npm run lint` and explicit `npm exec -- eslint e2e` both passed. The existing npm lint script scans `src` and `test`; the explicit command also verifies the new runner.
- Client production build: passed, with the existing >500 kB chunk advisory.
- Changed CheckoutPage ESLint and final `git diff --check`: passed. Existing Mongoose `new`-option deprecation notices remain informational; no dependency or SeatHold refactor was made for them.

Acceptance/integration limitations: real admission Ticket/QR issuance remains `PENDING_TICKET_MODULE`, and the exact original Team Development Plan contract/decision tabs and full C13/C14 iframe inspection remain unavailable as described above. No new business-decision blocker was introduced. The requested mock-Payment/Booking/food scope is verified; the broader Movie-to-issued-Ticket milestone is not marked Done or updated in the sheet.

Regression commands used (run from the indicated directory):

```powershell
# server/
node --test test/booking.test.js test/booking-authorization.test.js test/booking-lifecycle.test.js test/payment.test.js test/seat-hold.test.js test/concession-checkout.test.js
npm run lint
npm exec -- eslint e2e
# client/
node --test test/checkout-flow.test.js test/router-integration.test.js test/login-destination.test.js
npm exec -- eslint src/features/booking/pages/CheckoutPage.jsx
npm run build
# repository root
git diff --check
```

These targeted backend tests use their existing adapters; they are not additional browser E2Es. The real database evidence in this task is the new browser suite. Historical BOOK-010/CON-102 Mongo integration results are not counted as runs made by E2E-001. Early harness failures (currency separator, history-detail modal, modal close action, expected Payment mismatch HTTP status) were corrected without weakening durable assertions. The create-authorization fixture repair and actual reload/retry defect are described above.
