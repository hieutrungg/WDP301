# INT-FE-001 — Router/Header integration

Implementation date: 2026-10-25. Owner/integrator: Hieu. Scope: existing public screens, protected Booking/Payment/history screens and role workspaces; frontend navigation only.

## Sources and intended behavior

Read AGENTS.md, PROJECT_CONVENTIONS including approved A-16 role priority, REQUIREMENTS_STATUS, SCREEN_FLOW and relevant screen-flow.drawio entries. Current Iter2 row 11 authorizes Router/Header integration with cross-module review. Stitch project 12758682447811659045 was opened and its public/Executive navigation inspected (Home/Movies and role sidebar entries); existing F-Cinema styling and English labels are retained. No SRS or business decision is changed.

## Changes

- Restore public /concessions and STAFF-guarded /staff/concessions, which had menu links but no matching route in the current router. Reuse the approved read-only catalog; no cart/order/payment integration is introduced.
- Preserve all existing routes, including movie discovery, seat selection, checkout, both Booking confirmation URL forms, /my-tickets, /booking-history, profile and Manager/Admin/Staff modules.
- Export AppRoutes independently from the BrowserRouter wrapper so integration tests exercise the real route tree under MemoryRouter. Production still uses the same single BrowserRouter and ScrollToTop wrapper.
- Add a client-side 404 page for unmatched URLs with a Home link, instead of an empty route outlet. This is a frontend fallback, not a server HTTP-status/SEO change.
- Header Sign In records the current React Router location on desktop and mobile. Password and Google login pass that whole location to the shared destination resolver, preserving pathname/search/hash.
- The destination resolver keeps the existing role-home priority (ADMIN > MANAGER > STAFF > CUSTOMER) and same-role workspace rules. It normalizes internal URLs and rejects external/protocol-relative/backslash/control-character destinations and auth/error-page loops, including normalized double slashes. This remains frontend UX; backend authorization is unchanged.
- Offers has no implemented destination/section, so it displays a disabled Soon label on desktop/mobile. Theatres & Tickets still links to the existing home section. Search still uses the existing Movie query contract.
- Correct Manager breadcrumbs for Movies/create/edit, Rooms and Staff Shifts, and Admin breadcrumb for its read-only Rooms page. Preserve existing sidebar permissions and the create-only Manager movie link behavior.

## Changed files

- client/src/app/router/index.jsx
- client/src/components/common/Header.jsx
- client/src/features/auth/components/LoginForm.jsx
- client/src/features/auth/components/GoogleSignInButton.jsx
- client/src/features/auth/utils/loginDestination.js
- client/src/layouts/ManagerLayout.jsx
- client/src/layouts/AdminLayout.jsx
- client/src/pages/public/NotFoundPage.jsx
- client/test/login-destination.test.js
- client/test/router-integration.test.js
- docs/INT-FE-001-IMPLEMENTATION.md

## Verification

- node --test test/router-integration.test.js test/login-destination.test.js test/checkout-flow.test.js test/movie-search-params.test.js test/concession-catalog.test.js: 22 passed, 0 failed, 0 skipped.
- Route tests render the actual route tree using Vite SSR, MemoryRouter, QueryClientProvider and isolated auth snapshots. They cover public catalog/404, Staff role, Manager menu/permission/create-only path, Admin permissions, checkout/confirmation/history and login URL safety/role priority. An initial test harness issue with Zustand's SSR initial snapshot was corrected; no production auth workaround was added.
- Changed-file ESLint: passed. npm run build: passed, with existing >500kB bundle advisory.
- Full npm run lint: fails in untouched src/features/manager-showtimes/pages/ManagerShowtimesPage.jsx:115 (react-hooks/immutability, nextColor mutation), plus useMemo warning at line 813. No whole-client lint pass is claimed.
- Actual browser checks against an ephemeral loopback :5187 preview using real frontend/router and API responses only in memory: public Food & Drink opens; Guest checkout redirects to login; simulated password login restores /booking/.../checkout?retry=1#payment; Header Sign In from /movies?q=Dune&page=2 restores those filters; Header search correctly encodes Dune & Friends; account menu opens Booking History; Customer is denied Staff concession access; Staff concession page and sidebar work; Manager Room page/breadcrumb/sidebar work; Admin read-only Room route works; unknown URL shows 404; mobile 390x844 navigation expands and closes after a link is selected.
- Browser fixture never proxies API requests to development and never connects to Atlas. No new fixture-data source file is retained in the repository. Google login destination wiring is checked in code; no real Google login was executed. These are navigation checks, not backend RBAC certification or E2E-001.
- Mobile proof screenshot is stored outside Git under the session visualization folder as int-fe-mobile.png. Viewport override was reset after testing.

## Integration notes and limitations

No backend HTTP API, schema, index, enum, database data, dependency, lockfile, or business logic changes in this task. Existing BOOK-010 service/repository/test/report edits and the CON-102 proposal in the working tree are preserved.

No new implementation blocker for the navigation changes. Full-client lint has the unrelated error above; shared-file review with affected owners (Ha/Dat/Nam/Cuong) remains required before merge. Existing placeholder Dashboard/Scan/Promotions/Reports entries remain disabled; this task does not implement those features. Ticket issuance still uses the Payment-owned demo preview; E2E-001 and CON-102 are not completed by this task. Existing Footer placeholder links and language inside owner-specific Booking History screens are outside this change.

No sheet status, commit, push or merge was performed.
