# Concession Store and Cart Class Design

## Scope and Business Flow

Supports browsing branch-available concession items/combos, editing a cart, validating stock, checkout, creating a concession order, and reserving/decreasing inventory.

## Current Design Review

- The current service owns catalog reads, cart behavior, totals, order persistence, line persistence, inventory, and branch lookup through nine repositories.
- `OrderConcession` and `OrderCombo` are relational join entities that do not fit the documented Mongo order with embedded items.
- The cart is not modeled, although most controller methods are cart operations.
- Inventory is decreased directly during order creation without reservation, rollback, or payment outcome handling.

## Proposed Responsibilities and Relationships

Model `ShoppingCart` as an aggregate with embedded `CartLine` snapshots. `ConcessionCatalogQuery` serves menu views. `CheckoutConcessionCart` requests a price quote and inventory reservation, then creates `ConcessionOrder` with embedded immutable lines. Inventory confirmation/release follows payment outcome through a port.

Assumption: cart state is server-side for authenticated users; a guest cart may remain client-side until checkout.

Open Design Question: decide whether concession checkout can be independent of a movie booking.

