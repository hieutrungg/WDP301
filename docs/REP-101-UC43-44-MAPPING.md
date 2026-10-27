# REP-101 UC43 and UC44 Mapping

## Decision from the current SRS

| Use case | Correct function | Primary output | Period basis in BR-62 |
| --- | --- | --- | --- |
| UC42 | View Dashboard & Analytics | General operational dashboard | Requires its own approved KPI definitions |
| UC43 | Export Revenue Reports | Filtered financial report preview and PDF/Excel export | Payment or refund transaction date |
| UC44 | Analyze Movie Sales | Movie and showtime performance summary, charts, and detail | Screening date |

The SRS supports this mapping in three places: §3.6.1–§3.6.3 headings, the Use Case List entries 42–44, and detailed tables `CMS_UC43` and `CMS_UC44`. The table title and body match in the supplied current SRS. The older repository audit note claiming that UC43 describes movie analysis and UC44 describes general dashboard KPIs is stale and is corrected by this review.

## Scope boundary

UC43 is a financial reporting workflow. A Manager selects a period and optional branch, movie, or revenue-category filters, previews aggregated verified transaction data, chooses a supported export format, downloads the file, and leaves an export audit record. The SRS names gross ticket revenue, gross concession revenue, total gross revenue, successfully refunded amount, net revenue, sold-ticket count, and completed concession-sales count.

UC44 is a movie-performance analysis workflow. A Manager compares movie performance and can inspect a movie by showtime. The SRS names tickets sold, gross/refunded/net ticket revenue, scheduled and completed showtime counts, available seat capacity, valid tickets, occupancy, and average revenue measures. It is not the revenue-export use case and does not specify a file export flow.

UC42 remains the general dashboard use case. Do not fold general dashboard KPIs into UC44 merely because both belong to Reporting & Analytics.

## Requirements that remain open after REP-101

This task confirms the names and responsibility boundaries; it does not approve the implementation contract for REP-103–105. REP-102 now sums verified payments and completed refunds in a MongoDB read transaction using UTC instants. The user-facing timezone conversion, server-side source for a Manager's authorized branch scope, authoritative sources for completed showtimes and valid tickets, and refund attribution to UC44's screening-date period remain open. The SRS says UC43 uses payment/refund transaction date and UC44 uses screening date, so those period bases must remain distinct.

No change was made to the SRS or task workbook. The current SRS already has the corrected mapping; the stale repository audit and implementation notes were the parts that needed correction.
