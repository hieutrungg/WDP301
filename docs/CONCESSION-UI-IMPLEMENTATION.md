# Concession catalog UI — Hiếu / CON-102 read-only subset

Owner instruction: after approving CON-101, the user explicitly asked to begin the UI and provide Atlas data-entry guidance or a script. This authorizes the menu UI here; it does not approve the pending order/reservation/payment contracts.

## Behavior and design

- Public `/concessions` under PublicLayout, reachable from Header **Food & Drink**. Guest and signed-in users can browse; no cart/write/payment action is exposed.
- Staff `/staff/concessions` under existing STAFF guards/layout, reachable from **Concession Menu**. Defaults to the employee branch when present; public catalog reads may select another active branch because this does not grant protected Inventory access. Existing Header branch selection is reused for the public menu.
- Both use the approved public catalog API through feature API → shared httpClient. No API/shared enum/permission change was needed for UI.
- Branch selector, category navigation, separate Combo tab, API pagination, detail dialog with combo quantities, refresh, loading/error/retry/empty/no-branch states. Prior-branch responses are hidden and aborted; cards never retain availability from another branch.
- `available:false` immediately shows **Unavailable** on card/detail; zero price shows **Special offer** independently. Missing/broken item image uses a local code-rendered icon, not an invented product photo. No descriptions are generated.
- No cart add/order/checkout buttons are simulated. This is a menu, not a completed POS sales workflow. Guest cannot add to a cart because no cart feature exists here.
- Shared Header navigation now includes Food & Drink. Its branch picker appears from 1400px to avoid overlap with the new navigation item; navigation labels stay on one line. The feature provides its own branch picker at smaller widths.
- Stitch project `12758682447811659045` was opened visibly. Staff POS preview was read: dark palette, category tabs, product cards, prices and unavailable state. C13 node was located but still had no readable preview/image; no claim of exact C13 visual parity. Styling follows the existing F-Cinema tokens and verified Staff menu design. Screen Flow was read; concession is not inserted into ticket checkout.

## Data script

See `docs/CONCESSION-DATA-GUIDE.md` for exact dry-run/apply commands and Atlas Extended JSON examples. `server/src/scripts/import-concession-catalog.js` is insert-only with explicit DB/file, dry-run by default, remote-write guard, reference/recipe validation, conflict detection, transaction rollback and repeat-safe identical-ID skipping. It does not write inventory, ledger, categories, accounts, validators or indexes. Catalog DTO/model fields are unchanged.

Dry-run against `cinema_management_dev` verified the example file would insert 3 items and 1 combo. No development data was written. Actual import behavior was tested only against a disposable `conimp_test_*` database. Prices/names in the example are sample data, not new business requirements.

## Verification

Actual checks:

- Final changed-file frontend lint: passed (feature, router, Header, StaffLayout and presentation tests).
- `npm run build`: passed; Vite reports the existing >500kB chunk advisory. No new dependency was added.
- `node --test test/concession-catalog.test.js`: 2 passed, 0 failed, 0 skipped.
- Import unit + real Mongo tests: 3 passed, 0 failed, 0 skipped. Verified default dry-run, actual insert, repeat skip, conflict refusal, untouched stock and transaction rollback in a disposable `conimp_test_*` DB. An initial test failed because its generated DB name exceeded Atlas's name limit; the test prefix was shortened and the full suite rerun successfully, with cleanup guaranteed even if dropping the test DB fails.
- Whole-backend `npm run lint`: passed. `git diff --check`: passed.
- Browser fixture `client/test/fixtures/concession-preview.mjs --serve` on loopback :5185: checked branch selection and availability change, simultaneous unavailable/special-offer labels, missing/broken image fallback, detail dialog including Escape close, combo quantities, next/previous pagination, empty/loading/error/retry states, Staff role shell/default branch and Guest redirect from Staff route to login. The initial StrictMode dialog cleanup issue found during browser testing was fixed and the modal retested. Fixture never proxies to Atlas/development; production code contains no fixture data.
- Real development browser smoke via a temporary **GET-only** local preview at `http://127.0.0.1:5186/concessions`, real backend/Mongo with autoCreate/autoIndex disabled: selected F-Cinema Central, verified 10 real menu items and empty Combo tab, opened a real product detail. No database writes. The full app normally uses `/concessions` and `/staff/concessions`; the temporary preview deliberately rejects writes.
- Mobile 390×844 check on real data: document scrollWidth equals clientWidth (375px usable area with scrollbar); detail modal stays within viewport. Saved `concession-catalog-desktop.png` / `concession-catalog-mobile.png` from real data and `concession-staff.png` from the isolated Staff fixture under `client/test/fixtures/`.

Whole-client lint has an existing unrelated error in `client/src/features/manager-showtimes/pages/ManagerShowtimesPage.jsx:106` (`react-hooks/immutability`, nextColor reassignment) and a useMemo dependency warning at line 383. This task does not modify that file. Targeted changed-file lint, build, pure presentation tests, import tests and actual browser checks are reported separately; no full-client lint pass is claimed.

## Changed files and integration

- `client/src/features/concessions/{api/concessionApi,hooks/useConcessionCatalog,utils/catalogPresentation}.js` and `{components/CatalogCard,components/CatalogDetail,pages/ConcessionCatalogPage}.jsx`.
- Shared `client/src/app/router/index.jsx`, `client/src/components/common/Header.jsx`, `client/src/layouts/StaffLayout.jsx` (require affected frontend reviewer before merge).
- `client/test/concession-catalog.test.js`, `client/test/fixtures/concession-preview.mjs` and verified screenshots.
- `server/src/scripts/import-concession-catalog.js`, `server/test/concession-catalog-import{,.mongo}.test.js`.
- `docs/examples/concession-catalog.example.json`, `docs/CONCESSION-DATA-GUIDE.md`, `docs/CONCESSION-UI-IMPLEMENTATION.md`, scoped approval note in `docs/REQUIREMENTS_STATUS.md`.

API changes: none in this UI follow-up. DB changes: none applied to development; the user-run script can insert items/combos only. No new dependency. Hiếu owns UI/catalog, Nam owns stock reception/reservation, Cường reviews shared API/auth; no Inventory behavior changed. Broader CON-102 order/payment scope remains blocked until its contract is agreed. Existing MOV-103 work is preserved; no task marked Done, commit, push or merge.

## English UI correction and branch stock inspection (2026-10-22)

The user confirmed that the UI must be English. Re-read the Staff concession preview in Stitch project 12758682447811659045 (All Items, Combos, PRICE, Unavailable). Changed catalog page, card, detail dialog, presentation badge labels and presentation test expectations to English. Product/category values remain database content; VND formatting is retained.

Read-only development inspection confirmed that the three example concession IDs and one example combo ID are absent. Existing inventory records are grouped by branch; both manager and manager_2 are assigned to F-Cinema Central. Inventory service scopes reads to employeeProfile.branchId, and repository stock lookup matches both branchId and concessionId. Summary total counts active product types, not total quantity across branches. No Inventory behavior or account assignment was changed.

Validation after correction: presentation tests 2 passed; targeted feature/test ESLint passed; production build passed with the existing >500kB chunk advisory. Browser checked English menu and unavailable detail text against actual read-only development data. No API, schema, dependency or development database changes in this correction. No remaining blocker for the language correction; wider POS scope remains as recorded above.
