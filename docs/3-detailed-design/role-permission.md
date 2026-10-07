# Role and Permission Class Design

## Scope and Business Flow

Supports listing permissions, creating/updating roles, assigning permission sets, listing role details, and auditing administrative changes.

## Current Design Review

- Keep Role, Permission, role-management use cases, and audit logging.
- Remove `RolePermission` as a mandatory domain entity because the Mongo schema already stores `permissionIds` in Role. A join document is an infrastructure choice, not a domain concept.
- Remove direct JPA inheritance and reduce four repository dependencies to a Role aggregate repository plus Permission catalog port.
- Authorization checks must be policy/middleware concerns; the client cannot enforce security.

## Proposed Responsibilities and Relationships

Role is the aggregate root and owns a set of `PermissionId`. `ManageRoles` validates the requested permissions via `PermissionCatalog`, changes the aggregate, persists it, and writes an audit event. Uniqueness is protected by an index and repository check.

Assumption: permission definitions are system-controlled, while admins manage roles and assignments.

Compatibility constraint: the current account schema contains `directPermissionIds`, and repository governance marks its policy as pending owner review. This diagram focuses on role management and does not remove or migrate direct permissions. Effective authorization must continue to combine approved role grants with existing direct grants until that decision is resolved.

