# REP-103 Dashboard Metric Decisions

## SRS facts

UC42 (`CMS_UC42 - View Dashboard & Analytics`) names occupancy percentages, gross sales charts, and trending showtimes. Its sample period controls include Today, Week-to-date, and Quarter-to-date. Alternative A2 requires rejecting a Manager's request outside the assigned cinema branch scope. Alternative A4 requires recalculating with a consistent reporting scope and applicable data cutoff.

BR-62 defines gross revenue as successfully verified sales after discounts and before successful refunds. Net revenue subtracts successful refunds from the corresponding gross revenue. Revenue reports use payment/refund transaction date. BR-62 defines completed-showtime occupancy as valid tickets sold divided by total available seat capacity for those completed showtimes; a zero denominator must produce Not Available. Movie-sales analytics use screening date.

REP-102 provides totals for successful payments and refunds, but not a time-series or branch-scoped dashboard API. REP-103 cannot safely infer remaining calculation and access rules from those totals alone.

## Approved REP-103 metric contract (owner approval, 2026-10-27)

| Metric or filter | SRS-supported facts | Decision still needed |
| --- | --- | --- |
| Revenue chart | Show gross and net as separate series; net revenue is gross sales less successful refunds. Put each payment/refund in its own transaction date bucket. |
| Occupancy | Completed showtimes only, using valid tickets divided by available seat capacity as in BR-62. |
| Trending showtimes | Rank by valid tickets sold during the selected period. The API returns up to five; stable start-time/ID sorting resolves equal counts for repeatable display. |
| Period boundaries | Today, week-to-date (Monday start), and quarter-to-date use `Asia/Ho_Chi_Minh`; end at the generated-at cutoff. |
| Manager data scope | Resolve branch from authenticated account `employeeProfile.branchId` on the server; never accept a client-supplied branch ID. |

The project owner approved these choices in chat on 2026-10-27. Implementation is authorized for UC42/REP-103 only. The reporting period's event-time rule is transaction date for revenue and ticket issue date for the trending ranking; occupancy includes showtimes that started within the selected period and have ended by the cutoff. A zero occupancy denominator returns `null` (Not Available).
