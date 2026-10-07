# Inventory Management Class Design

## Scope and Business Flow

Supports stock-level queries, stock receipt, adjustment, reservations for concession checkout, low-stock status, and an immutable movement ledger.

## Current Design Review

- Keep BranchInventory and StockTransaction, but make inventory the aggregate that owns quantity changes.
- The current service manually updates BranchInventory and separately inserts StockTransaction, risking divergence.
- `StockTransaction` should be immutable evidence produced by aggregate behavior, not an entity with `createStockInTransaction()`.
- Add optimistic concurrency or atomic `$inc`/conditional updates; generic `save()` is unsafe under simultaneous checkout and stocking.
- Supplier is present in the database design but absent from the class diagram and flow.

## Proposed Responsibilities and Relationships

`InventoryItem` is identified by branch and product, holds on-hand/reserved quantities and reorder threshold, and emits a `StockMovement`. `ReceiveStock` uses one atomic repository operation that persists the new quantity and movement. Reservations have confirm/release lifecycle for checkout.

Open Design Question: define whether inventory tracks sellable units only or also recipes/components for combos.

