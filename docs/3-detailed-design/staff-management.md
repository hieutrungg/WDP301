# Staff Management Class Design

## Scope and Business Flow

Supports staff-account provisioning, employee assignment to a branch/roles, staff-shift monitoring/filtering, manager review, and audit logging.

## Current Design Review

- The existing diagram combines account provisioning and shift monitoring in one visual, but correctly hints that they are separate services. Keep that separation explicitly.
- Reconcile `Employee` and `employeeProfile` embedded in Account. The current database schema embeds employee data, while class diagrams use separate Account, Employee, and AccountRole entities.
- The provisioning service depends on six repositories and constructs records directly. Use Identity/Role/Branch ports and a transaction boundary.
- `StaffShift.markAsReviewed` needs reviewer/time/evidence, not only a boolean-like status.

## Proposed Responsibilities and Relationships

Use a separate `EmployeeProfile` aggregate only if staff lifecycle/query needs justify its collection; otherwise embed it in Account. This design selects a separate EmployeeProfile referenced by Account because shifts and branch assignment are independent operational records. `ProvisionStaffAccount` coordinates module ports. `ReviewShift` records a review in the StaffShift aggregate and writes an audit event.

Open Design Question: choose embedded employee profile or separate collection and update the database schema accordingly; do not implement both.

