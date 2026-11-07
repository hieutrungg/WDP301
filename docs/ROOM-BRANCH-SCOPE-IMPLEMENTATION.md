# ROOM-BRANCH-SCOPE: branch + role authorization for Room, Seat Map, Stock Levels, Stock-In

Date: 2026-11-07. Owner: Nam (Room, Inventory). Status: `PROPOSED`, pending owner approval and RBAC review (Cường).

## Why
Staff and Manager of Cinema A must not see or change Cinema B data on Room Management, Seat Maps, Stock Levels and Stock-In.

## Audit

| Screen | API | Role gate | Branch gate before | Branch gate after |
| --- | --- | --- | --- | --- |
| Stock Levels | `GET /api/inventory/stock-levels(/summary)` | `inventory.view` + STAFF/MANAGER | Yes (`requireBranchId`) | Unchanged |
| Stock-In + history | `POST/GET /api/inventory/stock-in` | `inventory.stock_in` + STAFF; history `inventory.view` + STAFF/MANAGER | Yes (`requireBranchId`) | Unchanged |
| Room Management | `/api/rooms/*` | `room.view`; writes `room.manage` + MANAGER | **None** | Own branch only |
| Seat Maps | `/api/rooms/:roomId/seat-layout` | `room.view`; writes `room.manage` + MANAGER | **None** | Own branch only |

Before this change a Manager of branch A could list every branch's rooms, create a room in branch B (`branchId` came from the body), and rename, retire, delete or re-draw the seat map of any room by id. Staff holding `room.view` could read any room through the API.

## Change
- `server/src/modules/room/room-scope.js` (new): `resolveBranchScope(account)`, `assertRoomInScope(room, scope)`, `resolveBranchFilter(requested, scope)`.
  - Scope is the account's `employeeProfile.branchId`, read from the DB account loaded by `requirePermission`, never from the request.
  - Only an account whose roles are ADMIN without MANAGER/STAFF is unscoped. Everyone else needs a branch, otherwise `403 BRANCH_NOT_ASSIGNED`.
  - Another branch's room, or another `branchId` in the query or body: `403 ROOM_WRONG_BRANCH`.
- `room.service.js`, `room-management.service.js`, `room.controller.js`: every user-facing read and write takes the scope. `requireRoom` checks it, so no path skips it.
- `getSeatLayout(roomId, scope = null)` keeps working without a scope because the Showtime module calls it internally. `getLayoutVersionForBooking` is untouched.
- Client (`features/room`): the manager view fixes the branch to the account's branch (no branch filter, locked branch in the "Add new room" drawer, branch name in the header). The Admin read-only view keeps its cross-branch filter. The API is the real boundary.
- Error code `ROOM_WRONG_BRANCH` is new. `BRANCH_NOT_ASSIGNED` reuses the inventory string.

## Tests
- `test/room-management.e2e.test.js`: new "rooms and seat maps are limited to the actor's branch" block (list/summary scoping, cross-branch filter 403, staff scoping, 6 cross-branch writes change nothing, own-branch writes still work, Admin reads all but cannot write, manager without branch). Existing cases updated because accounts are now bound to a branch. The old "unknown branch" case now returns 403 for a manager.
- `test/room-seat-layout.e2e.test.js`: cross-branch seat map read/PUT/POST refused, and the "unknown branchId filter" case now expects 403.
- `test/inventory.e2e.test.js`: already covers other-branch isolation (stock list, stock-in, history, no-branch account). No change.

Result of `npm test` in `server/`: 568 tests, 562 pass, 1 fail, 5 skipped. The failure is `development-seed.test.js` "SeatHold development seed adds immutable prices…" (`priceSnapshot` undefined). It uses in-memory fakes and touches no file changed here. I did not confirm it against a clean tree. Client `npm run build` passes. Client `npm run lint` reports 2 errors and 1 warning in `inventory/hooks/useInventory.js` and `manager-showtimes/pages/ManagerShowtimesPage.jsx`, which this change does not touch.

## Not done / follow-ups
- Stock Levels and Stock-In headers do not show the branch name yet (UX only; the backend already scopes them).
- `GET /api/inventory/categories` and `/suppliers` are global catalogs by design.
- Showtime management (Đạt) still creates showtimes against any room it is given. Its room list is now branch-scoped for a Manager through `/api/rooms`, but showtime endpoints are not branch-scoped. Needs Đạt's review.
- `PROJECT_CONVENTIONS.md` §10/A-16 says general branch RBAC is not approved. This is the narrow rule "Manager/Staff act only on their own branch's rooms", matching inventory, check-in and dashboard. Needs owner approval before it counts as approved.

Reviewer: Cường (RBAC). Shared files touched: none (no `app.js`, router, middleware or constants outside the room module). `docs/AUTHORIZATION.md` updated (§6, §7.2, §8.2).

No commit, push, merge or task-board update was made.
