
# CON-101 — Catalog contract review

Review date: 2026-10-22. Catalog-only implementation readiness: **APPROVED_READY** by the user's subsequent answers in this chat. Task board unchanged.

## Current owner approval — supersedes the historical proposal below

The owner rejected adding `isPublic` and Concession `description`. Use existing ACTIVE/INACTIVE for public eligibility in both Customer and Staff catalog. All ACTIVE validly priced items, including packaging if left ACTIVE, are public. No data is reclassified automatically. Names/size provide product detail; no new descriptive field is required. Missing optional media/description/size is serialized as null. Combo uses the existing designed fields; no image field is added to persistence.

The owner explicitly accepted items 1–4 in the follow-up: common stored integer VND price; missing/invalid price hidden; stored zero visible and marked as a special offer; required ACTIVE branch; out-of-stock still listed but explicitly unavailable; combo price stored separately and branch availability derived from the required component quantities; proposed public HTTP endpoints, validation, pagination and errors. The typo “không có giá thì ăn” is interpreted as “ẩn” in the context of the agreed missing-price question. `available` and additive `isSpecialOffer` are derived API booleans. C13/POS consumers must show “Không khả dụng” when available=false and “Khuyến mãi đặc biệt” when isSpecialOffer=true, including a zero-price item that is also unavailable. No generic voucher/promotion engine is introduced.

The five routes and bounded exported read adapters described below are authorized with these amendments. Inventory stock read returns only branch quantities to the catalog service; the public DTO never exposes them. Owner/consumer boundaries remain Hiếu (catalog), Nam (Inventory/Branch), Cường (shared API/auth). Existing Concession/Category models remain in Inventory and are reused via an Inventory-owned read adapter. New Combo runtime model maps the existing `combos` design/collection without adding fields/indexes or running DDL. Category visibility depends on eligible ACTIVE valid-price concessions, not current stock. Missing/inactive/non-priced combo components make an otherwise eligible combo unavailable. Malformed legacy recipes remain unavailable; unsafe component details are not exposed.

The business/read contract is owner-approved for CON-101; affected module integration review is still required before merge. No runtime sales UI, cart/order, stock mutation/reservation or payment is authorized by this approval. CON-102 remains responsible for those screens/workflows and authoritative checkout revalidation. No development Atlas migration/backfill, data edit, task Done, commit, push or merge is authorized or performed.

The following sections preserve the initial audit/proposal for traceability; `PROPOSED`, blockers, `isPublic` and optional schema additions in those historical sections do not override this current approval. Actual code and verification are documented in `docs/CON-101-IMPLEMENTATION.md`.

This document records findings and a concrete proposal for review. Every proposed endpoint, field, error and policy below is **PROPOSED**, not an approved shared contract. No runtime, DB, seed, permission or task-board change is made by this review.

## Sources checked

- `AGENTS.md`, `docs/PROJECT_CONVENTIONS.md`, `docs/REQUIREMENTS_STATUS.md`.
- [SRS - Group 5](https://docs.google.com/document/d/1MsY4icUgNeQQmqraR9AFvlyo7UFXNt6fDiOYC5cDaHU/edit): UC24, UC28–30, BR19, BR42, BR47. UC24 explicitly supports Guest browsing; BR47 requires active and publicly available items. BR19/42 and UC30 distinguish checkout reservations from finalized deductions.
- `docs/3-detailed-design/concession-store-cart.md`, `inventory-management.md`; `docs/cinema_database_schema.md` sections 2.18–2.23 and Inventory runtime additions; DB bootstrap validators.
- `docs/SCREEN_FLOW.md` and Customer/Staff nodes in `docs/screen-flow.drawio`. C13 is shown inside booking in the historical flow; current tracking explicitly excludes concession from ticket checkout MVP. No navigation is changed.
- [F-Cinema — Team Development Plan](https://docs.google.com/spreadsheets/d/132B2LC4Gbt0znLuHfiGsEtKXIZpsGy1-iou3PES_XDg/edit): Task Board, Module Ownership, API & Data Contracts, Requirement Decisions. The registry contains no approved concession catalog contract. INV-001 remains blocked in this older plan; the newer owner-approved UC39/40 scope in local requirements is recorded separately and must not be rolled back.
- [WDP301_G5_Project_Tracking](https://docs.google.com/spreadsheets/d/1MAx0E_PSI7R8fHpBKPF2tsIzboB8lf9Sh1ZwwFaz4O4/edit): Iter3 CON-101 says “schema và channel cần chốt” and “BLOCKED_BY_DECISION · chỉ chốt contract trước”; CON-102 says no order implementation before decisions. Task assignments identify Hiếu as Concession owner and Nam as Inventory owner. INV-102/103 activity or notes do not establish an approved catalog recipe/reservation contract.
- [Stitch project 12758682447811659045](https://stitch.withgoogle.com/projects/12758682447811659045): confirmed C13 and Sell Concessions nodes. Read the Staff POS preview: category tabs, item names/descriptions, prices, branch stock counts, combo cards and an out-of-stock disabled card. These sample values are visual references only. C13 node `dcd8c424e6af42e4abc83a34a841d497` remained a loading placeholder without readable preview content during this review; its design contents have **not** been verified. Staff node: `e9ec22b265de44d6948746573dd3c911`.
- Branch `movie`, existing uncommitted MOV-103 work, backend/frontend dependencies, Inventory repository/service/routes/models/seed/tests and Branch exported read service were inspected. No new dependency is needed for the proposed implementation.

## Owner decisions from this request

The following are explicitly approved by the user; they do not approve the proposals below:

- Guest can browse only. Cart requires a signed-in Customer in CON-102.
- Adding to cart neither reserves nor deducts inventory.
- Revalidation and reservation start at checkout, owned by CON-102 and Inventory.
- Simulated payment with an “I have paid” button is expected later; CON-101 does not implement payment.
- CON-101 excludes sales UI, cart/order creation, stock mutations, payment, full admin CRUD, promotions and ingredient management.

## Verified runtime and blockers

| Area               | Evidence                                                                                                                                           | Decision needed                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Reuse              | `inventory/concession.model.js` and `concession-category.model.js` are the only runtime catalog models; Inventory imports them directly        | Agree on a catalog read export and ownership transition; no duplicate model/collection                                     |
| Public visibility  | Concession has ACTIVE/INACTIVE for UC39/40 but no public/channel field. Existing seed includes ACTIVE packaging                                    | Define public eligibility and legacy default; ACTIVE alone would expose packaging                                          |
| Price              | Optional global `Concession.price`; no branch-price model                                                                                        | Global versus branch price; missing/invalid price visibility; never coerce missing price to zero                           |
| Description/media  | Concession lacks description. Category has description. Combo design lacks imageUrl                                                                | Approve optional schema additions and missing-data response; do not substitute category text as item description           |
| Combo              | DB design/bootstrap has `combos.items[{concessionId,quantity}]`; no runtime Combo model                                                          | Recipe validity, duplicate components, component eligibility, price and branch availability rules                          |
| Inventory boundary | All HTTP routes require auth + permission/role; `listStockLevels(account,query)` uses employee branch and returns internal quantities/thresholds | Approve a separate bounded read service for catalog; do not expose protected stock endpoints or import Inventory internals |
| Branch             | Existing `getBranchSummariesByIds` exported by Branch can provide identity/status                                                                | Require or allow omitted branch, behavior for nonexistent/inactive branches, missing stock rows                            |
| Wire contract      | No catalog routes or approved endpoint/error/query registry entry                                                                                  | Agree exact routes, fields, errors, pagination/filter and Staff use of public versus internal projection                   |

There is no independently APPROVED_READY catalog slice in the checked sources. Even item-only public reads depend on public eligibility and price policy. UC39/40 being approved does not approve publishing its internal stock catalog. Implementation of affected catalog reads is therefore stopped as required by AGENTS.md and the user's request. No blocked requirement has been relabeled approved.

## Concrete proposal for owner/consumer review

### Policies — PROPOSED

1. Use the existing global integer VND price for both channels. Require a valid stored nonnegative safe integer price for public eligibility; omit missing/invalid-price products from public lists. A stored zero remains distinct from a missing price. Add no branch-price collection.
2. Add optional `isPublic` to existing Concession and future Combo, and expose only `status === ACTIVE && isPublic === true`. Legacy records without this field stay private until explicitly classified. Do not bulk-publish existing Inventory records. Category lists contain only categories with eligible public products, excluding packaging unless explicitly approved as a sellable public item. Staff catalog uses this same projection; any internal-only products need a separate future contract.
3. Add optional Concession `description` and Combo `imageUrl`; return null for absent description/image/size. No generated text, remote placeholder asset or implicit price fallback. Categories return their own stored description or null. Empty lists return 200 with an empty array and meta.
4. Require `branchId` for item/combo lists and details. Accept only an existing ACTIVE Branch. Keep eligible out-of-stock products visible with `available: false`; do not publish quantity, threshold, supplier, ledger or employee data. Catalog availability is an advisory read and grants no checkout entitlement.
5. Recipe uses sellable Concession IDs and positive safe integer component quantities. Require a nonempty composition; reject duplicate IDs when authoring (no authoring API in CON-101), and treat malformed legacy recipes as unavailable. Require all components to exist, be ACTIVE, publicly eligible and validly priced. A valid recipe is available only when every branch component has sufficient stock for one combo. A missing inventory row means zero. No independent combo inventory, mutation or reservation is introduced. This is a suggested policy, **not** a decision inferred from INV-102.

### HTTP — PROPOSED, not callable yet

| Method/path                            | Inputs                                                    | data                                    |
| -------------------------------------- | --------------------------------------------------------- | --------------------------------------- |
| GET `/api/concession-categories`     | `page=1`, `limit=20` (max 100)                        | Category array: `id,name,description` |
| GET `/api/concessions`               | required `branchId`; optional `categoryId,page,limit` | Item array                              |
| GET `/api/concessions/:concessionId` | required `branchId` query; ObjectId path                | One item                                |
| GET `/api/combos`                    | required `branchId`; optional `page,limit`            | Combo array                             |
| GET `/api/combos/:comboId`           | required `branchId` query; ObjectId path                | One combo                               |

Item allowlist: `id,category:{id,name},name,description,size,imageUrl,price,branchId,available`. Combo allowlist: `id,name,description,imageUrl,price,branchId,available,items:[{concessionId,name,size,quantity}]`. Public recipe fields require explicit approval; no component stock counts. No search/sort/status/channel query is proposed for this first version. Lists use `{success:true,data:[],meta:{page,limit,total,totalPages}}`; details use `{success:true,data:{...}}`. Reject unknown/repeated/structured queries and malformed ObjectIds before persistence reads. Pagination must be positive integers within bounds; totalPages is zero for an empty list.

Proposed errors: 400 `INVALID_QUERY`, `INVALID_CONCESSION_ID`, `INVALID_COMBO_ID`; 404 `BRANCH_NOT_FOUND`, `CONCESSION_NOT_FOUND`, `COMBO_NOT_FOUND`, `CONCESSION_CATEGORY_NOT_FOUND`. Inactive Branch uses the same 404 as nonexistent. Nonpublic/inactive/invalid-price detail uses the same item 404 as nonexistent to avoid disclosing private products. Eligible but out-of-stock detail remains 200 with `available:false`. A valid but missing category filter returns category 404; an existing category with no public results returns an empty list. Operational failures use existing sanitized 500 handling and are never converted to empty/available results. Error code names and the visibility distinction remain pending approval.

Example call after approval and implementation (currently **not available**):

```http
GET /api/concessions?branchId=<active-branch-object-id>&page=1&limit=20
```

No login cookie would be needed for these proposed public reads. No admin endpoint or permission is proposed.

### Exported module contracts — PROPOSED

| Provider / owner                           | Consumer                        | Input → output                                                                                            | Errors / limits                                                                                                                                                                                                | Approval                                                     |
| ------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Inventory / Nam (MEMBER_2)                 | Catalog / Hiếu; later checkout | `readSellableStock({branchId,concessionIds})` → internal `Map<concessionId,{quantity}>`               | Valid ObjectIds, deduplicated IDs, bounded batches (propose 500); missing row → zero; DB/data error propagates, no fail-open. Inventory owns quantity semantics; reservation support must revisit this output | NOT APPROVED                                                 |
| Existing catalog persistence / Hiếu + Nam | Catalog service                 | An owner-exported read adapter over the single existing Concession/Category models → bounded catalog DTOs | Whitelisted fields, active/public policy, ID validation and pagination as agreed; no repository/model import from a new consumer module                                                                        | NOT APPROVED                                                 |
| Branch / Nam                               | Catalog / Hiếu                 | Existing `getBranchSummariesByIds(ids)` → summary Map                                                   | Reuse existing service; catalog applies approved public branch eligibility                                                                                                                                     | Existing export verified; new consumer usage requires review |
| Catalog / Hiếu                            | C13, Staff POS, CON-102         | Public HTTP DTO above                                                                                      | Availability advisory; CON-102 must obtain an authoritative server price/eligibility recheck and Inventory reservation at checkout                                                                             | NOT APPROVED                                                 |

Migration impact if approved: additive optional fields only on existing concessions and future combos; no Inventory key/index/quantity changes. Missing `isPublic` would stay private, requiring an explicit reviewed publication/backfill plan before a useful public catalog exists. New Combo model must reuse collection `combos` and tolerate/read legacy invalid recipes safely. Any validator/index change needs a versioned migration and affected owner review. No migration or data write ran in this task.

Before merge: Hiếu reviews catalog semantics; Nam reviews Concession model reuse, Inventory export and combo derivation; Cường reviews public/protected boundary, exact error contract and `app.js` mount; CON-102 consumer reviews DTO/checkout separation. Payment consumes no CON-101 event or stock side effect. No reservation TTL, payment/order status or management permission is decided here.

## Verification and blackbox handoff

No catalog endpoint was implemented, so Guest browsing, public visibility, catalog ID/query validation, empty/detail responses, price handling and combo availability tests are **NOT RUN**. Runtime catalog blackbox testing is blocked by the decisions above. No development account/data was created and no development seed was executed. The existing E2E suite creates and cleans up its own fixtures in `cinema_management_inventory_test`.

Existing Inventory regression command (isolated test database selected by the existing test):

```powershell
cd server
node --test --test-concurrency=1 test/inventory-seed.test.js test/inventory.e2e.test.js
```

Actual result: **15 passed, 0 failed, 0 skipped**, exit code 0, approximately 26.8 seconds. Coverage includes default-deny RBAC, branch assignment, active-item stock reads, filters/validation, stock-in audit, transaction rollback and eight concurrent receipts without lost updates. The logged simulated audit failure is the expected rollback scenario. This suite exercises existing Inventory, not the proposed catalog. Lint/client build are not needed for documentation-only changes and were not run.

After approval, blackbox fixtures should cover: two active branches with different stock, inactive/missing branch, public ACTIVE food, private ACTIVE packaging, INACTIVE food, missing/invalid price and stored zero, absent images/descriptions, empty category, never-stocked item, valid multi-quantity recipe, missing/inactive/private component, malformed recipe and foreign stock. Guest needs no account; protected Inventory regression requires existing Staff/Manager branch assignment and permissions. Do not edit/delete legacy data to manufacture passing fixtures.

## Changed files / implementation result

- New `docs/CON-101-CONTRACT-REVIEW.md`: evidence, blockers, proposed contract and integration/blackbox checklist.
- Appended a scoped blocker to `docs/REQUIREMENTS_STATUS.md`; existing uncommitted MOV-103 content is preserved.
- Implemented runtime behavior: none; API changes: none; DB changes: none; dependencies: none.
- UI, cart/order, reservations, payment, admin CRUD and catalog runtime remain unimplemented. No task was marked Done; no branch switch/reset, commit, push or merge occurred.
