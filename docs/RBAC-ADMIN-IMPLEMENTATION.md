# ROLE-101..103, STAFF-101, AUTH-101 — Implementation report

Owner: Cường (Auth, Account, RBAC). Date: 2026-10-27. Branch: `cuong/payment` (working tree only).

Scope (Iter3, Project Tracking): Role Management (UC45 Create Role, UC46 Update Role, UC47 Assign Permission To Role), Staff Account Management (UC35 Create, UC36 Update, UC37 Assign Staff Roles & Permissions) and a compliance review of Reset Password (UC04, G04-G04d). GATEWAY-101 (real payment gateway) is outside this task and was not touched. The Branch module (Nam) was not edited.

## 1. Decisions

Approved by Cường in chat on 2026-10-27 (also recorded in `REQUIREMENTS_STATUS.md` → Approval queue):

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Audit (CR-20/21, "logs the action") | New append-only `audit_logs` collection plus optional `createdBy`/`updatedBy` on `accounts` and `roles`. |
| D2 | Staff credentials (UC35 business rule) | No Admin-set password. The account is created `ACTIVE` with a random, unusable bcrypt hash; a welcome email (best-effort) tells the staff member to use Forgot Password (UC04, OTP) to set their own password. |
| D3 | System roles | Roles are never deleted (the SRS has no delete use case). The names `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER` are reserved and immutable. `ADMIN` is fully locked: it keeps every permission and cannot be edited, so no Admin can lock all Admins out. |

Applied with these decisions (from SRS/BR and existing approved rules):

- BR-26/BR-32: every endpoint needs the ADMIN role in addition to the grant. MANAGER holds `staff.manage` in the seed but is refused, and a direct grant alone never opens these screens.
- "Staff account" = an account holding at least one role other than `CUSTOMER`. `CUSTOMER` cannot be assigned from staff management; a CUSTOMER role an account already holds is kept as is.
- Self-protection: an Admin cannot disable their own account or remove their own ADMIN role.
- A-05: `directPermissionIds` is never wiped. UC37 revokes a direct grant only when the Admin unticks it; omitting the field keeps the current grants.
- A-02/A-16 session policy: there is no token revocation. A DISABLED account is refused at login (BR-28) and by every permission-guarded request and `/auth/me` on its next request.

## 2. API contract

All routes need `requireAuth`. Responses use `{ success, message?, data, meta? }` and errors use `{ success:false, code, message, errors[] }`.

### Roles and permissions (`server/src/modules/role-permission`)

| Method / path | Guard | Body / query | Result |
| --- | --- | --- | --- |
| `GET /api/permissions` | `permission.view` + ADMIN | — | Predefined list `{ id, name, description, group }` |
| `GET /api/roles` | `role.view` + ADMIN | `q`, `kind=system\|custom`, `page`, `limit≤50`, `sort=name\|createdAt\|updatedAt`, `order` | Roles with `isSystem`, `isLocked`, `permissionCount`, `activeAccountCount`; `meta` pagination |
| `GET /api/roles/:roleId` | `role.view` + ADMIN | — | Detail with `permissions[]`, `createdBy`/`updatedBy` |
| `POST /api/roles` | `role.manage` + ADMIN | `name`, `description?`, `permissionIds[]`, `confirmNoPermissions?` | 201 MSG35 "Role created successfully." |
| `PATCH /api/roles/:roleId` | `role.manage` + ADMIN | any of `name`, `description`, `permissionIds` + `confirmNoPermissions?`, `confirmAffectedAccounts?` | 200 MSG28 "Saved successfully." |
| `PUT /api/roles/:roleId/permissions` | `permission.assign` + ADMIN | `permissionIds[]` + confirmations | 200 MSG36 "Permissions assigned successfully." |

Role errors: `ROLE_VALIDATION_FAILED` (400, MSG01/02/03 per field), `ROLE_NAME_TAKEN` (409, case-insensitive, also for reserved system names), `PERMISSION_INVALID` (400, BR-33), `SYSTEM_ROLE_LOCKED` (409, ADMIN), `SYSTEM_ROLE_NAME_LOCKED` (409), `ROLE_NOT_FOUND` (404). The CR-05 guards return 409 `ROLE_EMPTY_PERMISSIONS_CONFIRMATION_REQUIRED` (UC45 5, UC46 5, UC47 3) and 409 `ROLE_AFFECTED_ACCOUNTS_CONFIRMATION_REQUIRED` (UC46 8, UC47 6), which names the active-account count, until the matching confirmation flag is sent. A request that changes nothing writes nothing and records no audit entry.

### Staff accounts (`server/src/modules/account/staff-account.*`)

The router requires `account.manage` + the ADMIN role.

| Method / path | Extra guard | Body / query | Result |
| --- | --- | --- | --- |
| `GET /api/staff-accounts` | — | `q` (name/username/email/phone), `status=ACTIVE\|DISABLED`, `roleId`, `page`, `limit≤50`, `sort=createdAt\|username\|fullName\|email\|status`, `order` | Staff summaries; `meta.counts { total, active, disabled }` |
| `GET /api/staff-accounts/options` | — | — | Assignable roles (with `permissionIds`), permission list, ACTIVE branches |
| `GET /api/staff-accounts/:accountId` | — | — | Detail with `roleIds`, `directPermissions[].grantedByRoles` (UC37 4a), `effectivePermissions[]`, `createdBy`/`updatedBy` |
| `POST /api/staff-accounts` | — | `fullName`, `email`, `username`, `phone`, `roleIds[≥1]`, `directPermissionIds?`, `branchId?`, `position?` (no password field; strict schema) | 201 MSG35 "Staff account created successfully."; `meta.credentialSetup { method: "PASSWORD_RESET", emailSent }` |
| `PATCH /api/staff-accounts/:accountId` | — | any of `fullName`, `email`, `phone`, `branchId`, `position` (username is fixed) | 200 MSG28 |
| `PATCH /api/staff-accounts/:accountId/status` | — | `status` | 200 MSG28 |
| `PUT /api/staff-accounts/:accountId/access` | `permission.assign` | `roleIds[≥1]`, `directPermissionIds?` | 200 MSG36 |

Staff errors: `STAFF_VALIDATION_FAILED` (400, MSG01/02/03; roles use "At least one role is required."), `DUPLICATE_ACCOUNT` (409; all clashing fields reported: MSG06 "This email is already registered.", username, phone; case-insensitive, BR-01), `STAFF_ROLE_INVALID` (400: unknown role or CUSTOMER), `PERMISSION_INVALID` (400), `STAFF_BRANCH_INVALID` (400), `CANNOT_DISABLE_SELF` (409), `CANNOT_REMOVE_OWN_ADMIN_ROLE` (409), `STAFF_STATUS_NOT_CHANGEABLE` (409: pending account or concurrent change), `STAFF_ACCOUNT_NOT_FOUND` (404, also for customer accounts).

### Auth (UC04, BR-28)

- `POST /api/auth/forgot-password` → MSG07 worded for the OTP variant: "A password reset code has been sent to {email}." (UC04 step 5 allows "link or verification code"; the system sends a code, so the word "link" was not used.)
- `POST /api/auth/reset-password` → MSG09 "Your information has been updated successfully. You can now sign in with your new password."
- Confirmation mismatch (reset, register, change password) → MSG08 "Password confirmation does not match."
- Login of a `DISABLED` account → 403 "This account has been disabled. Please contact an administrator." The session reload message ("This account is not allowed to sign in") is unchanged because it is a tested PLAT-002 contract.
- Unchanged and verified: unregistered email → 404 field error (UC04 A4); OTP valid for 5 min, at most 5 wrong attempts, verified code valid 10 min, single use (deleted when consumed), 60 s resend cooldown, dedicated rate limiters (BR-05); BR-03 password rules on server and client.

## 3. Database impact

- `accounts`: optional `createdBy`, `updatedBy` (ObjectId). Existing documents stay valid (the validator has no `additionalProperties` restriction).
- `roles`: optional `createdBy`, `updatedBy` and Mongoose timestamps. Seeded roles without them stay valid.
- New `audit_logs` (`audit-log.model.js`, `autoIndex: false`, no secondary index because there is no read use case yet). Actions: `STAFF_ACCOUNT_CREATED/UPDATED/ENABLED/DISABLED`, `STAFF_ACCESS_ASSIGNED`, `ROLE_CREATED/UPDATED`, `ROLE_PERMISSIONS_ASSIGNED`. `changes` holds before/after values or added/removed names, never secrets. Documented in `cinema_database_schema.md` §2.3a.
- No migration, seed or Atlas write was run against the shared/development database. Tests use the throwaway `cinema_management_rbac_test`, dropped before and after the run.

## 4. Frontend (`client/src/features/access-control`)

- Routes (UX guard only): `/admin/staff-accounts` (`account.manage`) and `/admin/roles` (`role.view`), nested in the existing Admin guard. AdminLayout menu: "Staff Accounts" and "Roles & Permissions" enabled, breadcrumbs added.
- **Role Management**:
  - Searchable, filterable (system/custom), sortable and paginated list with system/locked markers, permission counts and active-account counts.
  - A Create/Update drawer for name, description and permissions, and an "Assign permissions to role" drawer.
  - Permissions are picked from a grouped, searchable list (BR-33).
  - A confirmation dialog appears before saving a role with no permissions or changing a role held by active accounts. If the server reports a confirmation the screen did not know about, the dialog shows the server message.
  - ADMIN opens read-only, and system role names are read-only.
- **Staff Account Management**:
  - Summary cards (total/active/disabled).
  - Search, status and role filters, sortable columns and pagination (CR-08/09).
  - Create drawer (UC35): information, branch/position, at least one role, optional direct permissions. A note explains that no password is set, and a warning appears if the welcome email failed.
  - Update drawer (UC36): current status, roles, created/updated by and when; username is read-only.
  - Enable/Disable with a confirmation dialog (CR-05), unavailable for the Admin's own account.
  - "Assign roles & permissions" drawer (UC37):
    - Role picker that requires at least one role; the Admin's own ADMIN role is locked.
    - Direct-permission picker. A grant already provided by a selected role shows "Already granted via assigned role (…)" and stays selected.
    - Live effective-permission count, and a confirmation summary before saving.
- Field errors appear next to each field with SRS 5.3 messages (CR-04). Server field errors map back onto the form. Times show as `dd/MM/yyyy HH:mm` in Asia/Ho_Chi_Minh.

## 5. Use-case compliance

| UC | Main / alternative flow | Where |
| --- | --- | --- |
| UC04 | Steps 1-11; A4 unregistered email error; A6 invalid/expired code; A9 password rules / MSG08 | auth service/controller/validation; `ForgotPasswordForm` G04-G04d; `password-reset.e2e.test.js`, `rbac-admin.e2e.test.js` |
| UC35 | Form with role list; 7a required/format; 7b duplicate email/username (+ phone, BR-01); 7c at least one role; creates with roles, audit; MSG35; secure credential mechanism | `createStaffAccount`; `StaffFormDrawer` |
| UC36 | List → select → current info/status → edit → validate → save + audit; disable asks for confirmation and blocks sign-in / next request (BR-28) | `updateStaffAccount`, `changeStaffStatus`; `StaffFormDrawer`, status `ConfirmDialog` |
| UC37 | Shows roles, direct grants and catalogs; 6a at least one role; 6b unknown role/permission; 4a redundancy indicator, grant kept; recompute (BR-29) and audit; MSG36 | `assignStaffAccess`; `StaffAccessDrawer` |
| UC45 | Form with permission list; 7 empty/duplicate name; 5 zero-permission warning + confirmation; audit; MSG35 | `createRole`; `RoleFormDrawer` (create) |
| UC46 | List → select → current info → edit → validate → save + audit; 5 zero-permission confirmation; 8 affected active accounts notice; MSG28 | `updateRole`; `RoleFormDrawer` (edit) |
| UC47 | Current permissions marked; 3 zero-permission confirmation; 5 invalid permission; 6 affected accounts notice; MSG36; BR-34 next-request effect | `assignRolePermissions`; `RoleFormDrawer` (permissions) |

## 6. English UI review (Iter2 + Iter3)

A Unicode scan for Vietnamese letters in `client/src` and `server/src` (excluding comments) after this change finds none in Cường's screens or APIs:

- C14 Checkout payment parts and `MockPaymentModal`, C15 Booking Confirmation, C17 E-Ticket, the payment/ticket APIs: already English.
- C16 `CustomerBookingsPage` (created by Cường in `fa6ec49`, later edited by Hiếu and Hà): 39 Vietnamese UI strings translated to English. Text only, no logic change. Hiếu/Hà should review.
- New Iter3 screens and all new API messages: English.
- Remaining Vietnamese UI text is in other owners' files only (`counter-pos/CounterCompletePage.jsx`, `room/SeatGrid.jsx`), which were not touched.

## 7. Files

Server, new:
- `modules/audit/{audit.constants,audit-log.model,audit.service}.js`
- `modules/role-permission/{role.constants,role.validation,role.service,role.controller,role.routes}.js`
- `modules/account/{account.constants,staff-account.validation,staff-account.service,staff-account.controller,staff-account.routes}.js`
- `utils/srsMessages.js`
- `test/rbac-admin.e2e.test.js`

Server, changed:
- `app.js`: 2 imports + 3 mounts.
- `account.model.js`, `account.repository.js`, `account.service.js` (read contracts), `account.validation.js` (MSG08).
- `role.model.js`, `role.repository.js`.
- `auth.service.js` (BR-28 login message), `auth.controller.js` (MSG07/MSG09), `auth.validation.js` (MSG08), `email.service.js` (staff welcome email).

Client, new:
- `features/access-control/**` (api, hooks, schema, utils, components, pages)
- `test/access-control.test.js`

Client, changed:
- `app/router/index.jsx`: 2 imports + 2 nested routes.
- `layouts/AdminLayout.jsx`: menu items and breadcrumbs.
- `features/auth/{components/ForgotPasswordForm.jsx, schema/forgotPasswordSchema.js, schema/registerSchema.js}`
- `features/booking/pages/CustomerBookingsPage.jsx`: English text.
- `test/router-integration.test.js`

Docs: this file, `REQUIREMENTS_STATUS.md` (rows UC04, UC35-37, UC45-47, RBAC note, Approval queue), `cinema_database_schema.md`.

## 8. Verification (2026-10-27)

- `server`: `npm run lint` clean.
- `server`: `npm test`: 550 tests, 542 pass, 3 fail, 5 skipped.
  - The 3 failures are pre-existing and in other owners' tests:
    - `concession-checkout.mongo.test.js` (2 entries, Staff receives 409 instead of 403 after commit 88612d3).
    - `development-seed.test.js` (seat-hold price undefined).
  - The 5 skips are Mongo tests that need `MONGODB_TEST_URI`.
  - The new `rbac-admin.e2e.test.js` passes 27/27 against Atlas (throwaway DB).
- `client`: `node --test test/`: 94/94 pass, including 8 new access-control tests and 1 new router test.
- `client`: `npm run lint`: only the pre-existing error in `ManagerShowtimesPage.jsx:115` (Đạt).
- `client`: `npm run build` succeeds (only the existing chunk-size warning).

## 9. Known limitations / follow-ups

- Audit records are written after the saved change, with no transaction. If the audit insert fails, the error is logged and the admin action still stands.
- No token revocation (A-02). Routes guarded only by `requireAuth` (customer booking/payment/ticket reads) do not reload account status. Every permission- or role-guarded route and `/auth/me` do.
- Phone uniqueness is checked in the application only. The shared `accounts` collection has no unique phone index, and adding one needs a reviewed migration (existing data may contain duplicates).
- Custom roles grant permissions only. Routes that also require a system role (`requireRole("STAFF")`, `"MANAGER"`, `"ADMIN"`) still need that system role.
- Stitch screens "Role Management" / "Staff Account Management" are not exported locally (`docs/screens` has no copy). The UI follows the existing Admin Branch screens' design tokens and should be compared with Stitch during review.
- Cross-owner review: Nam (Branch read contracts `getBranchSummariesByIds` / `listBranches` used by the staff form), Hiếu (router/AdminLayout integration, C16 text), Hà (C16 text).

No commit, push, merge or task-board/Google Sheet update was made.
