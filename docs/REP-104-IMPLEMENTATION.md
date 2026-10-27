# REP-104 Revenue Export

## Implemented in the working tree

- Manager revenue report screen follows the supplied Revenue Reports layout direction and uses live server data only.
- Filters: inclusive Vietnam-local date range, assigned branch (read-only), optional movie, and `ALL` / `TICKETS` / `CONCESSIONS` category. Range is limited to 366 calendar days.
- Preview reports successful verified payments and successfully processed refunds, transaction journal, pagination, and empty/loading/error states.
- Excel `.xlsx` and PDF exports include the chosen filters, branch, reporting period, generation/cutoff metadata, summary, and transaction journal.
- Successful export attempts append a `report_exports` audit record. Failed export generation does not create an audit record.
- Manager permissions are `report.view` and `report.export`; backend guards enforce both, and branch scope comes from the authenticated account's `employeeProfile.branchId`.
- Dates are interpreted in `Asia/Ho_Chi_Minh`; the end date is inclusive and represented by the next local midnight as the exclusive UTC boundary. Query and export use a Mongo snapshot transaction and one generation cutoff.

## Data semantics and open integration point

Gross total is the amount of successful payments (already after any applied discount); net revenue subtracts successful refunds. Ticket and concession components come from the saved booking/order subtotals. The current booking shape stores a discount at booking level without a category allocation, so when a combined ticket/concession payment has a nonzero discount, its components cannot be represented as post-discount category revenue without inventing an allocation rule. The screen currently exposes these component snapshots transparently while total gross/net remain transaction-authoritative. The group should approve a discount allocation rule before claiming category totals fully satisfy UC43 in discounted combined sales.

Concession sale count means a successful payment with a positive concession component. It does not imply pickup fulfillment. The report's movie filter scopes transactions linked to a movie/showtime; standalone concession orders remain available only with All movies.

## API

- `GET /api/reports/options` — assigned branch and movie filter options.
- `GET /api/reports/revenue?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&movieId=&category=&page=&limit=` — preview and transaction journal.
- `GET /api/reports/revenue/export?fromDate=...&toDate=...&movieId=&category=&format=xlsx|pdf` — binary download.
- All routes require authenticated `MANAGER` + `report.view`; export additionally requires `report.export`. The request cannot specify a branch.

## Database and rollout

New append-only-by-application collection `report_exports` records actor, branch, format, filters, generation/cutoff time, creation time, and exported transaction count. Migration `server/src/migrations/20261027-rep-104-report-export.js` adds its lookup indexes and idempotently grants the two existing report permissions to the MANAGER role. Do not run against a database without the usual rollout approval. No operational payment, booking, order, or refund data is changed.

Dependencies added to the server: ExcelJS for real OpenXML `.xlsx` files and PDFKit for PDF generation. No SRS or tracking workbook was changed.

## Verification and integration notes

- Static syntax validation: `node --check` for the new server service, repository, routes, and migration.
- No tests were added or run for this task.
- Run the migration before enabling the route for deployed Managers. A MongoDB replica set is required for the consistent snapshot transaction.
- Pending review: reporting/payment/concession owners should confirm category allocation for discounted combined purchases and whether “completed concession sales” should count paid orders or only fulfilled pickups. No value is fabricated for either policy.
