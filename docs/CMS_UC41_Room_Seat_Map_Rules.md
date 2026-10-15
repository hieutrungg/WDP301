# CMS_UC41 — Configure Room Seat Maps
> Rules and implementation guide for Claude Code  
> Project: Cinema Management System  
> Source: `Room use case.docx`, section **3.5.8. Configure Room Seat Maps**

## 1. Purpose

Implement the Manager workflow for creating, viewing, editing, and managing a cinema room's seat-layout template. The layout is a row-by-column matrix that defines seat coordinates, row identifiers, seat classifications, aisle/blank positions, and accessible/handicap locations.

The implementation must preserve the source use case's safety constraint: **a room layout must not be structurally updated when it is actively linked to published future showtimes**.

## 2. Source use case

| Field | Definition |
|---|---|
| Use case ID | `CMS_UC41` |
| Name | Configure Room Seat Maps |
| Primary actor | Manager |
| Secondary actor | None |
| Preconditions | The target physical theater room already exists as an item profile in the operational branches catalog. |
| Main flow | Manager opens Auditorium Settings, selects a room, configures the row/column grid, classifies positions, marks blank aisle positions or handicap locations, reviews calculated capacity, and saves the template. |
| Alternative flow | If the template is actively linked to published future showtimes, the system denies structural grid updates. Template changes can only apply to future showtime creations that are not yet linked to the current template. |
| Postcondition | The room's structural layout configuration is persisted in the database. |
| Business rules in source | None explicitly listed. The showtime protection rule is stated in the alternative sequence and is mandatory. |

## 3. Terminology

Use these terms consistently across frontend, backend, API, and database code.

- **Room**: an existing physical screening auditorium.
- **Layout template / seat map**: the configurable row-by-column structure for a room.
- **Position / node**: one cell in the matrix. A position may be a sellable seat or a non-seat position.
- **Seat type**: `STANDARD`, `VIP`, or `DOUBLE_LUXURY` (the source calls this “Double Luxury”).
- **Aisle / blank position**: a matrix cell that is not a seat and must not contribute to sellable seat capacity.
- **Accessible position**: a position marked for handicap/accessibility use. The source does not specify whether it must also have a seat type; define this consistently in the implementation and document the choice.
- **Published future showtime**: a future showtime already published and actively linked to the room layout.

## 4. Required user workflow

1. Manager opens **Auditorium Settings**.
2. System lists/selects an existing room.
3. System loads that room's saved layout, if one exists; otherwise it presents an empty builder.
4. Manager sets the row and column dimensions and row identifiers.
5. Manager selects a brush/type and applies it to one or more matrix positions.
6. Manager can mark positions as aisle/blank or accessible.
7. System recalculates seat counts and total operational seat capacity as the layout changes.
8. Manager reviews the layout and saves.
9. Backend validates permissions, room existence, layout structure, and showtime constraints before persisting.
10. System reports success or a clear validation/conflict error.

## 5. Business and validation rules

### 5.1 Rules explicitly required by the source

- **R-01 — Existing room only:** a layout can only be configured for a room that already exists in the operational branches catalog.
- **R-02 — Manager workflow:** configuration is a Manager use case. Backend write operations must be protected by the project's Manager authorization policy.
- **R-03 — Matrix configuration:** the layout must represent row-by-column positions and preserve row identifiers.
- **R-04 — Position classification:** the builder must support Standard, VIP, and Double Luxury seat types.
- **R-05 — Non-seat/accessibility markers:** the builder must allow positions to be marked as blank aisle space or handicap/accessibility locations.
- **R-06 — Derived capacity:** the system must count position types and calculate total operational seat capacity from the saved/current matrix.
- **R-07 — Save to database:** saving must persist the room layout configuration.
- **R-08 — Published-showtime protection:** if the layout is actively linked to published future showtimes, deny structural grid changes to preserve transactional safety.
- **R-09 — Future-only template changes:** changes that cannot safely affect currently linked showtimes must be applied only to future showtime creations not linked to the existing template.

### 5.2 Recommended implementation rules (inferred to make the feature reliable)

These rules are implementation recommendations, not additional statements from the source document. Align them with the existing project conventions before coding.

- **R-10 — Valid dimensions:** row and column counts must be positive integers and must not exceed configurable system limits.
- **R-11 — Unique row identifiers:** each row identifier in a layout must be non-empty and unique. Preserve the displayed row order.
- **R-12 — Valid matrix:** the submitted matrix must match the configured dimensions. Reject missing, duplicated, or out-of-range coordinates.
- **R-13 — One position state:** each coordinate must have exactly one primary state: `SEAT` or `AISLE`/`BLANK`. Accessibility should be a separate flag or a clearly defined seat subtype, not an accidental conflicting primary state.
- **R-14 — Seat type required for seats:** a sellable seat must have one supported seat type. A blank/aisle position must not be counted as a sellable seat.
- **R-15 — Capacity is derived:** do not trust a client-submitted capacity as the source of truth. Calculate capacity on the server from the validated matrix and return the calculated result.
- **R-16 — Atomic save:** validate and persist the dimensions, positions, and derived values as one logical operation. Avoid partially saved layouts.
- **R-17 — Concurrency:** re-check showtime linkage on the backend at save time, not only when the editor initially loads. If the constraint has become active, reject the structural update.
- **R-18 — No silent mutation of published showtimes:** never renumber, delete, or reclassify positions in a layout version already referenced by published future showtimes.
- **R-19 — Clear errors:** return a stable error code and actionable message for invalid layouts, unauthorized access, missing rooms, and protected layouts.
- **R-20 — Idempotent editing:** saving an unchanged valid layout should not create duplicate room-layout records.
- **R-21 — Auditability:** if the project has audit fields, record who changed the layout and when.
- **R-22 — Safe deletion:** do not physically delete a layout while it is referenced by showtimes or bookings. Prefer rejecting deletion or using the project's established archive/soft-delete convention.

## 6. CRUD scope

Implement the CRUD operations below using the project's existing architecture, naming, response envelope, authentication, and error-handling conventions. Do not introduce a second pattern if the repository already has one.

| Operation | Suggested endpoint | Purpose |
|---|---|---|
| Create | `POST /api/rooms/:roomId/seat-layout` | Create the first layout for an existing room. |
| Read one | `GET /api/rooms/:roomId/seat-layout` | Load the room layout and derived seat counts. |
| Read list | `GET /api/seat-layouts` or the existing room-list endpoint with layout summary | List layouts if the application needs a management overview. Do not add a redundant endpoint if the existing API already covers this. |
| Update | `PUT /api/rooms/:roomId/seat-layout` | Replace/update the complete layout configuration after validation. |
| Delete/archive | `DELETE /api/rooms/:roomId/seat-layout` | Optional management operation. Must be blocked if the layout is referenced by published future showtimes, bookings, or other protected records. Confirm product requirements before exposing this operation. |

**Important:** The source use case explicitly requires configuring and saving a layout, but does not explicitly require deleting layouts or a standalone list endpoint. Treat those CRUD additions as proposed scope and follow existing project requirements.

### 6.1 Create

- Confirm the room exists.
- Confirm the actor is authorized as Manager.
- Confirm a layout does not already exist if the data model allows only one current layout per room.
- Validate dimensions, row identifiers, coordinates, and position states.
- Calculate capacity on the server.
- Persist the layout atomically.
- Return the created layout and capacity summary.

If the project supports layout versioning, create a new version rather than overwriting a version referenced by showtimes.

### 6.2 Read

- Verify the room exists; return the project's standard not-found response otherwise.
- Return dimensions, row identifiers, matrix positions, seat types, accessibility markers, and derived capacity/counts.
- Include a capability/lock indicator if the UI needs to know whether structural editing is currently allowed.
- Do not expose internal secrets or unrelated user/payment data.
- Ensure frontend display order is deterministic (row order, then column order).

### 6.3 Update

- Confirm Manager authorization and room/layout existence.
- Validate the complete submitted layout.
- Check whether the current layout is actively linked to published future showtimes.
- If protected, reject structural grid updates. Do not partially save the request.
- If not protected, save the valid changes atomically and recalculate capacity on the server.
- Return the persisted layout, not merely the raw request body.
- If the project uses versions, create a new version and keep historical references intact.

### 6.4 Delete or archive (optional)

- First check all references, including showtimes and bookings, using the project's actual data model.
- Reject deletion when protected references exist.
- If the system needs historical records, archive/soft-delete rather than hard-delete.
- Do not cascade-delete showtimes, bookings, seats, or payments as a side effect of deleting a layout.
- If the project does not require layout deletion, omit this operation from the UI and API.

## 7. Capacity calculation

Calculate capacity from position data, not from the matrix's raw number of cells.

Recommended definition:

- `totalPositions = rowCount × columnCount`
- `standardCount = number of positions classified as Standard seats`
- `vipCount = number of positions classified as VIP seats`
- `doubleLuxuryCount = number of positions classified as Double Luxury seats`
- `accessibleCount = number of positions marked accessible` (this may overlap with a seat-type count)
- `aisleCount = number of blank/aisle positions`
- `operationalSeatCapacity = standardCount + vipCount + doubleLuxuryCount`

Rules:
- Aisle/blank positions are excluded from `operationalSeatCapacity`.
- Accessibility is a marker/count, not an additional seat, unless the project explicitly models it as a separate seat type.
- Do not add `accessibleCount` to capacity if accessible positions are already counted in Standard/VIP/Double Luxury totals.
- Define whether an accessible position is also a sellable seat and enforce that definition consistently in schema, validation, UI, and API.
- The source does not define whether “Double Luxury” counts as one seat or two people. **Do not multiply its capacity by two unless the product requirements explicitly say to do so.** Under the recommended default, each configured sellable position counts as one operational position.

## 8. Showtime safety / layout versioning

This is the most important transactional rule in this use case.

Before saving structural changes, the backend must determine whether the current layout is actively linked to any published future showtime.

- If **no protected showtimes exist**, allow a valid update.
- If **protected showtimes exist**, reject the structural grid update with a conflict response and explain that the layout is in use.
- Do not rely solely on a frontend disabled button; enforce the rule on the backend.
- Re-check at save time to reduce race conditions.
- Do not mutate the seat coordinates/identities that existing showtimes or bookings depend on.

Recommended long-term design: version layouts. A showtime references a specific layout version; new template changes create a new version for future showtimes, while existing showtimes retain the version they were created with. This implements the source's requirement that changes apply only to future, unlinked showtime creations. Confirm whether versioning fits the current database model before implementing it.

The source does not define the exact time-zone policy or whether “future” means start time greater than server time. Use the project's established time-zone convention and compare against a consistent server-side timestamp.

## 9. Suggested data model (adapt to the existing schema)

This is a conceptual shape, not a requirement to create these exact collection/table names.

```ts
type SeatType = "STANDARD" | "VIP" | "DOUBLE_LUXURY";
type PositionType = "SEAT" | "AISLE";

interface SeatPosition {
  rowLabel: string;
  rowIndex: number;
  columnNumber: number;
  positionType: PositionType;
  seatType?: SeatType;       // required when positionType === "SEAT"
  isAccessible: boolean;
}

interface RoomSeatLayout {
  id: string;
  roomId: string;
  rowCount: number;
  columnCount: number;
  rowLabels: string[];
  positions: SeatPosition[];
  version?: number;          // use if layout versioning is implemented
  standardCount: number;     // server-derived
  vipCount: number;          // server-derived
  doubleLuxuryCount: number; // server-derived
  aisleCount: number;        // server-derived
  operationalSeatCapacity: number; // server-derived
  createdAt: string;
  updatedAt: string;
}
```

Schema notes:
- Adapt names and types to the actual project (MongoDB/Mongoose, SQL/JPA, etc.).
- Do not duplicate fields that can be derived unless the project needs persisted snapshots or query optimization.
- Add a unique constraint/index for one current layout per room if that is the chosen model.
- If using embedded positions, validate the complete array and coordinate uniqueness.
- Accessibility can overlap with `SEAT`; it should not create an extra position.
- Decide whether a “blank” cell and an “aisle” are the same state. The source groups them as blank aisle space; if the product needs separate visual meanings, model them explicitly.

## 10. API contract guidance

Follow the existing API response envelope. If the project uses a standard wrapper such as `success`, `message`, `data`, and `timestamp`, keep that wrapper rather than inventing a new one.

Example request for create/update (illustrative only):

```json
{
  "rowLabels": ["A", "B", "C"],
  "columnCount": 8,
  "positions": [
    {
      "rowLabel": "A",
      "rowIndex": 0,
      "columnNumber": 1,
      "positionType": "SEAT",
      "seatType": "STANDARD",
      "isAccessible": false
    },
    {
      "rowLabel": "A",
      "rowIndex": 0,
      "columnNumber": 2,
      "positionType": "AISLE",
      "isAccessible": false
    }
  ]
}
```

The example is partial for readability; the real request must include every required coordinate in the configured matrix or use a documented sparse-matrix convention. Do not assume sparse matrices are valid without deciding and enforcing the rule.

Recommended error categories (adapt to existing error conventions):
- `ROOM_NOT_FOUND`
- `SEAT_LAYOUT_NOT_FOUND`
- `SEAT_LAYOUT_ALREADY_EXISTS`
- `INVALID_SEAT_LAYOUT`
- `SEAT_LAYOUT_IN_USE`
- `FORBIDDEN`
- `INTERNAL_ERROR`

Suggested status semantics:
- `400 Bad Request`: malformed dimensions or invalid position data.
- `401 Unauthorized`: unauthenticated request, if this matches the project's security conventions.
- `403 Forbidden`: authenticated actor lacks Manager permission.
- `404 Not Found`: room/layout does not exist.
- `409 Conflict`: layout is protected by published future showtimes or create would violate uniqueness.
- `500 Internal Server Error`: unexpected failures, without leaking stack traces.

## 11. Frontend requirements

- Provide a room selector/list and a row-column layout builder.
- Provide controls for dimensions and row labels.
- Provide a brush/type selector for Standard, VIP, and Double Luxury.
- Provide tools to mark aisle/blank positions and accessibility positions.
- Visually distinguish each position type and include an accessible legend.
- Show live counts for each seat type, aisle positions, accessibility markers, and total operational seat capacity.
- Recalculate the preview immediately as the Manager edits, but treat the server's returned capacity as authoritative after save.
- Clearly indicate when structural editing is locked due to published future showtimes.
- Disable the save action while a request is pending; prevent duplicate submissions.
- Show validation errors near the relevant controls and a clear success/failure notification.
- Do not present a disabled button as the only protection; backend enforcement is mandatory.
- Support keyboard focus and usable labels; do not rely on color alone to communicate seat types.
- On load failure, distinguish “no layout yet” from “failed to load layout.”

## 12. Security and data integrity

- Enforce Manager authorization on every write endpoint on the server.
- Validate every incoming field; do not trust client-calculated capacity, IDs, row indexes, or showtime lock flags.
- Derive room ID from the route and verify it against the target layout.
- Use the project's established authentication, validation, logging, and exception-handling patterns.
- Never return database credentials, tokens, stack traces, or internal exception details to the client.
- Ensure failed validation or a showtime conflict leaves the stored layout unchanged.
- If database transactions are supported, use them for layout persistence and related version/reference changes.

## 13. Acceptance criteria

- [ ] A Manager can select an existing room and load its saved layout.
- [ ] A Manager can configure rows, columns, and row identifiers.
- [ ] Standard, VIP, and Double Luxury positions can be assigned.
- [ ] Blank/aisle and accessibility positions can be marked.
- [ ] Counts and operational capacity update as positions change.
- [ ] A valid layout can be saved and remains correct after reloading.
- [ ] Invalid dimensions, duplicate coordinates, unsupported types, and inconsistent matrices are rejected.
- [ ] A nonexistent room cannot receive a layout.
- [ ] A non-Manager cannot create, update, or delete/archive a layout.
- [ ] A layout linked to published future showtimes cannot receive a prohibited structural update.
- [ ] The showtime protection is checked by the backend at save time.
- [ ] A rejected save does not partially modify the database.
- [ ] Aisle/blank positions are excluded from operational seat capacity.
- [ ] Accessibility markers do not accidentally inflate capacity.
- [ ] If versioning is used, existing showtimes retain their original layout version and new changes are available for future showtimes.
- [ ] API errors follow the project's established response format.

## 14. Suggested test cases

### Positive
1. Create a valid layout for an existing room.
2. Read the layout and verify matrix order and counts.
3. Update seat classifications when no protected showtimes exist.
4. Mark a position as aisle and verify capacity decreases by one.
5. Mark a seat as accessible and verify capacity does not increase twice.
6. Save, reload, and verify persisted data matches the server-calculated result.

### Negative / boundary
1. Create a layout for a nonexistent room.
2. Submit zero, negative, non-integer, or excessive dimensions.
3. Submit duplicate coordinates or row labels.
4. Submit a matrix whose positions do not match configured dimensions.
5. Submit an unsupported seat type.
6. Mark a position as aisle while also submitting an incompatible seat type.
7. Submit a fake client capacity and verify the server ignores/recalculates it.
8. Attempt write operations without Manager authorization.
9. Attempt structural update while a published future showtime references the layout.
10. Create a protected showtime after the editor loads but before save; verify the save-time check rejects the unsafe update.
11. Attempt to delete/archive a layout that is referenced by showtimes or bookings.
12. Simulate a persistence failure and verify there is no partial update.

## 15. Instructions for Claude Code

When implementing this feature:

1. **Inspect the repository first.** Identify the actual backend/frontend frameworks, folder structure, room model, showtime model, authentication/role mechanism, API response format, and validation/error-handling conventions.
2. **Reuse existing code.** Do not create parallel models, duplicate endpoints, new response envelopes, or a second authorization pattern when equivalents already exist.
3. **Trace the data relationships.** Determine how rooms, showtimes, bookings, and seats are currently linked before designing schema changes.
4. **Separate source requirements from assumptions.** The mandatory requirements are in Sections 2 and 5.1. Recommendations in Section 5.2 and conceptual examples must be adapted to the actual project.
5. **Implement backend validation first.** The showtime safety rule and capacity calculation must be enforced on the server.
6. **Implement CRUD according to existing conventions.** Create/read/update are core. List and delete/archive are optional unless already required by project scope.
7. **Keep changes focused.** Avoid unrelated refactoring and dependency additions.
8. **Add tests** for business rules, authorization, capacity, and showtime conflicts using the project's existing test framework.
9. **Run available checks.** Run relevant tests, lint, and build commands. Report commands and results accurately; do not claim checks passed if they were not run.
10. **Summarize the implementation.** List files changed, API endpoints, rules implemented, tests run, and any assumptions that need confirmation.
11. **Do not silently weaken the protection rule.** If the existing data model makes it impossible to determine whether a layout is linked to published future showtimes, stop and report the missing relationship instead of guessing.
12. **Ask only when a decision blocks safe implementation.** Examples: whether layout versioning is supported by the existing model, whether Double Luxury represents one or two sellable places, and how accessibility positions are counted. Otherwise follow established project conventions and document assumptions.

## 16. Source gaps to confirm

The source use case does not specify:
- Maximum row/column dimensions.
- Whether a room may have multiple layout templates or versions.
- Whether Double Luxury is one sellable position or represents two people.
- Whether accessibility is a marker on a normal seat or a separate position type.
- Whether “blank” and “aisle” need different types.
- Whether layout deletion is permitted.
- The exact schema/relationship used to identify showtimes linked to a layout.
- Whether published showtimes may be migrated to a new layout version.
- The exact API routes, database technology, and project response conventions.

Do not invent product decisions for these gaps. Inspect the codebase and existing requirements, then document any necessary assumption.
