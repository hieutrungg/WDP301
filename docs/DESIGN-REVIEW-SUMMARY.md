# Software Design Review Summary

## Scope and Evidence

This review covers the complete `SDS - G5 - V1.docx`, with emphasis on Software Architecture, backend/frontend Package Diagrams, the 17 class diagrams in Detailed Design, their sequence diagrams, collection descriptions, constraints, and class specifications. The original Drive document was not modified.

## Major Problems in the Current Design

- The technology description conflicts internally: Spring Boot vs Express, MySQL vs MongoDB, and JPA repositories vs Mongoose.
- The architecture is a generic three-tier picture and does not show dependency inversion, consistency boundaries, scheduled jobs, or adapter ownership.
- Backend packages are organized globally by technical role, producing feature scattering and unrestricted repository access.
- Most services are transaction-script "god services" with many repositories and responsibilities.
- Domain objects are often anemic while services calculate or change their state externally.
- Mongoose/Mongo persistence is modeled as JPA inheritance, and sequence diagrams make a fictional `JpaRepository` call the database.
- Several models duplicate the same identity (`Customer` vs embedded account profile; `Employee` vs embedded employee profile; role arrays vs `AccountRole` documents).
- Static room seats, showtime-seat availability, seat holds, bookings, tickets, orders, and payments are not clearly separated.
- Concurrency and idempotency are missing from seat selection, voucher redemption, gateway callbacks, ticket validation, refund processing, and inventory changes.
- Reporting is modeled both as persisted `Report` behavior and as ad-hoc queries, with no read-model boundary.
- Relationships and multiplicities are mostly omitted; dependency arrows are frequently used where association/composition is intended.
- Type conventions conflict (`Long`/`int`, ObjectId, Date/LocalDateTime), and many names expose UI actions or persistence mechanics instead of business intent.

## Architectural Decisions

1. Adopt a modular monolith with Clean/Hexagonal boundaries per business module.
2. Standardize the documented stack on React, Express, Mongoose, and MongoDB, matching the repository and database section.
3. Use `api -> application -> domain`, with infrastructure adapters implementing inward-owned ports.
4. Organize backend and frontend primarily by feature; keep shared packages deliberately small.
5. Model critical lifecycle rules in aggregates and policies, not controllers or repository-heavy services.
6. Treat reporting/analytics as query-side read models and exporters.
7. Require atomic/idempotent handling for seats, vouchers, callbacks, refunds, scans, and stock.

## Redesigned Diagrams

- Software architecture and package structure
- Authentication
- Customer profile
- Movie exploration
- Movie management
- Showtime management
- Online booking
- Concession store and cart
- Counter ticketing and validation
- Role and permission
- Promotion and loyalty
- Payment gateway
- Cancellation and refund
- Inventory management
- Room and branch management
- Staff management
- Reporting
- Analytics

## Breaking Conceptual Changes

- `ServiceImpl` and `JpaRepository` are removed from the conceptual model.
- `Customer` is folded into the Account aggregate's profile; payment/booking history becomes a query concern.
- MongoDB role permissions are represented as a Role aggregate containing permission IDs, not a relational `RolePermission` entity unless the implementation chooses a separate collection for scale/audit reasons.
- A room seat definition is distinct from `ShowtimeSeat`/`SeatHold`; availability belongs to a showtime.
- Booking, ticket, payment, and refund become separate lifecycles connected by IDs and application orchestration.
- Payment callbacks and ticket scans have explicit idempotency requirements.
- Reports and analytics use read models; a `Report` entity is not persisted by default.

## Assumptions

- The Express/Mongoose codebase and MongoDB database are authoritative where the SDS contradicts itself.
- Deployment remains a single backend process initially.
- One account can hold multiple roles. Existing `directPermissionIds` remain part of the current data contract pending owner review; this redesign does not authorize their removal.
- Seat holds expire and are acquired atomically per showtime.
- Tickets are issued only after payment success or an authorized counter sale.
- Refund processing is asynchronous and retryable.

## Open Design Questions for the Team

1. Choose JWT-only, refresh-token rotation, or server-side sessions; logout semantics depend on this.
2. Confirm whether customers can purchase concessions without a movie booking.
3. Define cancellation cutoff, partial-refund policy, gateway fees, and who approves exceptional refunds.
4. Decide whether vouchers are unique per customer, globally reusable up to a limit, or generated per campaign.
5. Confirm seat-hold duration and whether MongoDB transactions are available in the deployment topology.
6. Clarify whether room layout edits may occur when only unsold future showtimes exist, or whether any published showtime locks the layout.
7. Define the source of staff shift tracking and what constitutes a discrepancy/review.
8. Confirm whether reports must be stored as audit artifacts or generated on demand.
9. Define revenue recognition: successful payment time, showtime completion, or net of refunds.
10. Resolve the pending owner decision for direct account permissions. Until then, `directPermissionIds` must remain compatible even though role-based grants are the primary path in these diagrams.

## Governance Blocker

The workspace `AGENTS.md` refers to `docs/PROJECT_CONVENTIONS.md` and `docs/REQUIREMENTS_STATUS.md`, but neither file exists in the current checkout. No implementation, API, enum, error-code, ID, or database-relationship change was made. Before implementing this conceptual redesign, the team should restore or create those governance artifacts and record approval status for each breaking change.

## Validation Result

The redesigned diagrams use one naming model and dependency rule from architecture through packages to classes. PlantUML sources contain no external includes, so they remain portable and reviewable. Source-level syntax validation is performed separately; rendering depends on PlantUML availability in the environment.
