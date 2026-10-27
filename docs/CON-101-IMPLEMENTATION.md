# CON-101 — Concession Catalog

Date: 2026-10-22. Scope: read-only catalog API for Guest, Customer and Staff. Business/read contract owner-approved in this chat; integration review is required before merge. Task board is unchanged, not marked Done.

Subsequent user-authorized UI follow-up is implemented separately: see `CONCESSION-UI-IMPLEMENTATION.md` for public/Staff menu screens and `CONCESSION-DATA-GUIDE.md` for Atlas/manual/script data entry. Statements below about no UI describe the original CON-101 backend delivery, not the later UI follow-up. The latter adds no API/model field change or development data write.

## Approved behavior

- Reuse the existing Inventory-owned Concession and ConcessionCategory models and collections. All ACTIVE products with a valid global nonnegative safe-integer VND price are public, including ACTIVE packaging. No `isPublic` field, publication backfill or Concession description field is added. Names and size carry product detail.
- Missing/null/string/negative/fractional/unsafe/nonfinite prices are hidden. Stored zero is retained, with `isSpecialOffer:true`. This is a display marker, not a promotion/voucher engine.
- Existing integer BSON numeric prices (`int`, `long`, `double`, `decimal`) are normalized to a safe JSON number after validating their stored value. Fractional Decimal128 values are rejected before conversion, so rounding cannot accidentally make a price eligible. No data migration is required.
- Required `branchId` must identify an ACTIVE Branch. Out-of-stock items remain visible with `available:false`; missing stock rows mean zero. `available` and `isSpecialOffer` are independent and can both be false/true as appropriate.
- Combo uses its own stored price and the existing designed `combos.items[{concessionId,quantity}]` recipe. Require a nonempty recipe of unique valid IDs and positive safe-integer quantities. All components must exist, be ACTIVE and have valid prices. Availability checks every component's required quantity at the selected branch. No independent combo inventory is created.
- Invalid legacy recipes or missing/inactive/unpriced components keep the combo visible but unavailable, with `items:[]` to avoid exposing invalid/private component details. A valid recipe with insufficient stock remains visible with its public component details.
- No stock counts/thresholds, suppliers, ledger, employee/account data or raw model documents are exposed publicly. Optional absent media/description/size returns null. Concession description remains null; Combo `imageUrl` is returned when stored and otherwise remains null. Existing category/combo descriptions remain readable.
- Only categories with at least one ACTIVE valid-price Concession appear in category discovery, independently of current branch stock. A legacy item whose referenced category is missing returns `category:null`; no foreign relationship is silently repaired.
- Reads are advisory and do not hold/deduct stock, create cart/order/payment/ticket or mutate catalog data. Item and combo availability may change between reads; checkout must revalidate authoritatively.

This supersedes the historical proposal in `CON-101-CONTRACT-REVIEW.md`. No general catalog admin permission or order/payment lifecycle is decided here.

## HTTP contract

All five GET endpoints are public; no account/cookie is required. No write endpoint is provided.

| Path | Query / path | Response data |
| --- | --- | --- |
| `/api/concession-categories` | optional `page,limit` | Category array: `id,name,description` |
| `/api/concessions` | required `branchId`; optional `categoryId,page,limit` | Concession array |
| `/api/concessions/:concessionId` | ObjectId path; required `branchId` query | Concession detail |
| `/api/combos` | required `branchId`; optional `page,limit` | Combo array |
| `/api/combos/:comboId` | ObjectId path; required `branchId` query | Combo detail |

Pagination defaults to page 1 / limit 20, max limit 100; positive decimal-integer query strings only. Technical page bound is `floor(Number.MAX_SAFE_INTEGER / 100)` so offset calculation stays safe. Deterministic `_id` ascending order is used; there is no sort/search/status/channel query. Unknown, repeated and structured parameters are rejected. ObjectIds are normalized to lowercase after validation.

Lists use `{success:true,data:[],meta:{page,limit,total,totalPages}}`. Empty lists return 200 and totalPages 0. Pages beyond the last retain the actual total and return `data:[]`. Details use `{success:true,data:{...}}`.

Concession allowlist: `id,category:{id,name}|null,name,description:null,size,imageUrl,price,branchId,available,isSpecialOffer`.

Combo allowlist: `id,name,description,imageUrl:null,price,branchId,available,isSpecialOffer,items:[{concessionId,name,size,quantity}]`.

| Status | Code | Condition |
| --- | --- | --- |
| 400 | `INVALID_QUERY` | Missing/invalid branch, invalid category ID, unknown/repeated/structured query, invalid pagination |
| 400 | `INVALID_CONCESSION_ID` / `INVALID_COMBO_ID` | Invalid detail path ObjectId |
| 404 | `BRANCH_NOT_FOUND` | Missing or INACTIVE branch |
| 404 | `CONCESSION_CATEGORY_NOT_FOUND` | Valid but nonexistent category filter |
| 404 | `CONCESSION_NOT_FOUND` / `COMBO_NOT_FOUND` | Missing, inactive or invalid-price product |
| 500 | Existing sanitized error envelope | Infrastructure/corrupt stock failure; never converted to successful empty/available response |

Out of stock is a successful detail/list with `available:false`, not a 404. An existing category with no eligible results returns an empty list. Branch eligibility is checked before resource lookup. Errors retain `{success:false,code?,message,errors}`.

Example calls (substitute real existing IDs):

```powershell
curl.exe "http://localhost:5000/api/concession-categories"
curl.exe "http://localhost:5000/api/concessions?branchId=<active-branch-id>&page=1&limit=20"
curl.exe "http://localhost:5000/api/concessions/<concession-id>?branchId=<active-branch-id>"
curl.exe "http://localhost:5000/api/combos?branchId=<active-branch-id>"
curl.exe "http://localhost:5000/api/combos/<combo-id>?branchId=<active-branch-id>"
```

## Provider / consumer integration

| Provider / owner | Consumer | Export / behavior | Approval / migration |
| --- | --- | --- | --- |
| Inventory / Nam (MEMBER_2) | Catalog / Hiếu | `concession-catalog.read-service.js`: paged eligible category/item reads, eligible item detail, category existence and bounded component reads using the single existing models. Components include status/price for server eligibility validation | Owner-approved for this task; affected module review before merge. Read-only, no data migration |
| Inventory / Nam | Catalog / Hiếu | `stock-read.service.js`: `readSellableStock({branchId,concessionIds})` → internal Map of ID to `{quantity}`. At most 500 IDs per call, deduplicated. Missing row → zero; invalid stored quantity or DB failure propagates a sanitized 500 | Owner-approved bounded read contract. Not an authoritative reservation or sellable-after-reservation contract; Inventory reservation work must revisit semantics |
| Branch / Nam | Catalog / Hiếu | Reuse existing `getBranchSummariesByIds`; require ACTIVE branch | No Branch change |
| Catalog / Hiếu | C13, Staff POS, CON-102 | Five public GET endpoints and DTOs above | Owner-approved; shared reviewer Cường (MEMBER_5) and affected consumers review before merge |

Shared integration changed: `server/src/app.js` mounts the catalog router under `/api`. Existing protected `/api/inventory/*` endpoints retain requireAuth/permissions/roles. No shared error middleware, permission enum or dependency changed.

CON-102 UI must immediately show **“Không khả dụng”** and disable selection when `available === false`; show **“Khuyến mãi đặc biệt”** when `isSpecialOffer === true`, without hiding an unavailable label. These labels are consumer obligations; **no C13/POS screen or UI badge has been implemented in CON-101**. This task remains backend-only per the original scope. Customer cart needs auth; cart add does not reserve stock. Checkout must obtain an authoritative server price/eligibility check and Inventory reservation. Payment gets no event/side effect from catalog reads.

## DB and deployment impact

- New read-only Mongoose Combo model maps existing designed fields/collection `combos`. It sets `autoCreate:false`, `autoIndex:false` and declares no index. Importing it does not create the collection, change validators or backfill data.
- Existing Concession, Category, Inventory models/IDs/relationships/indexes/seeds are unchanged. No fields were added to Atlas or existing model schemas. No migration, development seed, validator/index operation or development data write was performed.
- A missing/empty combos collection yields an empty list. Existing legacy malformed recipes are handled at read time, without repair/deletion.
- New reads use existing identity lookups and a bounded catalog page. No speculative index is added; price/visibility filtering may scan the catalog. Benchmark/review indexes if the catalog grows significantly.
- No new dependency or environment variable. No commit, push, merge, reset, branch switch or task-board update.

## Verification

Actual results (all exit code 0):

- Final `node --test --test-concurrency=1 test/concession-catalog.test.js test/concession-catalog.mongo.test.js`: **20 passed, 0 failed, 0 skipped**, approximately 23.9 seconds. Includes legacy BSON-price compatibility and the 501-component page batching check.
- Existing Inventory regression `test/inventory-seed.test.js test/inventory.e2e.test.js`: **15 passed, 0 failed, 0 skipped** in the preceding combined catalog/Inventory run (**33 total** at that point, before adding the final batch scenario). Expected simulated audit failure logs accompany the passing rollback test.
- Final `npm run lint` (whole backend source/tests): passed.
- `git diff --check`: passed.
- Frontend build/UI smoke: not run; no frontend changes. No claim that the future UI labels are rendered yet.

Test files:

- `server/test/concession-catalog.test.js`: validation, recipe integrity, Combo model mapping and bounded provider input.
- `server/test/concession-catalog.mongo.test.js`: real Mongo + HTTP Guest reads, active/price policy, optional fields, public projection, branch availability, IDs/query errors, pagination/empty results, quantity-aware combos, invalid legacy recipes, protected Inventory isolation, no read side effects, sanitized errors and provider batching.
- Existing Inventory seed/E2E suite: unchanged regression coverage for permission/branch scope, stock queries, receipts, transaction rollback and concurrency.

Catalog tests create and clean a uniquely named database `cinema_con101_test_<pid>_<timestamp>` on the configured Mongo host; autoCreate/autoIndex are disabled. Existing Inventory E2E uses `cinema_management_inventory_test`. No catalog test is permitted to drop the configured development DB. These tests use disposable fixtures, not the development seed.

## Blackbox data and remaining scope

Guest needs no login. Start the backend normally, choose an existing ACTIVE Branch ID via `/api/cinemas`, inspect `/api/concession-categories`, then call item/combo endpoints above. Existing priced ACTIVE items are immediately visible by the approved status-only rule. Existing missing-price or INACTIVE items remain hidden. Existing combos appear only if present and ACTIVE with valid price; no demo combos are inserted on Atlas. There is no admin authoring endpoint in this scope.

Read-only development smoke on 2026-10-22 (temporary local HTTP listener, autoCreate/autoIndex disabled): all three catalog list endpoints returned 200. F-Cinema Central branch `1851a60cabd9ec93d832e74b` returned 4 public categories, 10 concessions and 0 combos. Example existing item: `6710c1000000000000000001`, Smoked Sausage Hotdog, price 75000, available=false at Central. Existing ACTIVE packaging is also visible as approved. No development data was edited. Useful immediate blackbox calls:

```http
GET /api/concessions?branchId=1851a60cabd9ec93d832e74b
GET /api/concessions/6710c1000000000000000001?branchId=1851a60cabd9ec93d832e74b
GET /api/combos?branchId=1851a60cabd9ec93d832e74b
```

The development DB currently has no public combos in this smoke result; zero-price and combo cases were verified using isolated automated fixtures, not by inserting demo data into Atlas.

For full manual acceptance, use a separate test DB with two branches, distinct component stock, ACTIVE/INACTIVE/missing-price/zero-price items, a never-stocked item and valid/invalid combo recipes. The automated HTTP test creates this matrix and verifies it. No development accounts/passwords were created. To check protected Inventory manually, use an existing Staff/Manager account with its branch assignment and appropriate existing permission.

No remaining business blocker for approved catalog reads. Manual browser UI verification is not applicable because no UI was changed. C13's Stitch preview could not be read during the original audit (loading placeholder); Staff POS preview was read. CON-102, reservation/deduction/payment lifecycle and catalog CRUD remain outside this implementation. No claim is made that the broader Concession sales requirement or task is Done.

## Changed files

- `server/src/app.js` — additive router mount.
- `server/src/modules/concession/{combo.model,concession.repository,concession.service,concession.validation,concession.controller,concession.routes}.js` — catalog runtime.
- `server/src/modules/inventory/{concession-catalog.read-service,stock-read.service}.js` — Inventory-owned exported read adapters.
- `server/test/concession-catalog{,.mongo}.test.js` — contract/unit and Mongo/HTTP verification.
- `docs/CON-101-CONTRACT-REVIEW.md`, `docs/REQUIREMENTS_STATUS.md` — explicit owner approval and superseded blocker/proposal traceability.
- `docs/CON-101-IMPLEMENTATION.md` — this API/integration/verification/blackbox report.

Unrelated existing MOV-103 work remains untouched.
