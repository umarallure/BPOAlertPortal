# Page metrics and data documentation

This folder documents **where data comes from**, **how it is queried**, and **how metrics are calculated** for each main **sidebar area** in the default dashboard layout (`app/layouts/default.vue`). Use it for operations, onboarding, and reconciling numbers with Supabase.

## Index

| Document | Sidebar area | Routes |
|----------|--------------|--------|
| [score-board.md](./score-board.md) | Score Board | `/` |
| [daily-deal-flow.md](./daily-deal-flow.md) | Daily Deal Flow | `/daily-deal-flow` |
| [bpo-centers.md](./bpo-centers.md) | BPOs Performance | `/bpo-centers` |
| [colombian.md](./colombian.md) | Colombian | `/colombian-score-board`, `/colombian-daily-deal-flow`, `/colombian-bpo-centers` |
| [alerts.md](./alerts.md) | Alerts | `/alerts` |
| [reports.md](./reports.md) | Reports | `/reports/agencyperformance`, `/reports/callcenterperformance` |
| [on-boarding-guide.md](./on-boarding-guide.md) | On Boarding Guide | `/on-boarding-guide/*` |
| [settings.md](./settings.md) | Settings | `/settings`, `/settings/*` child routes |

## Shared conventions

### Calendar and time zones

- **Date columns** on `daily_deal_flow` are compared using strings from **`formatDateEST`** (`Intl.DateTimeFormat` with `timeZone: 'America/New_York'`, `en-CA` short date). See `app/utils/index.ts`.
- **Working days** for analytics-style rollups use **`getWorkingDatesBetween(start, end, { excludeSaturday: true })`**: Monday–Friday only (Saturdays excluded; Sundays remain in the range if present).
- **Prior-period comparison** for those working-day sets uses **`getPreviousBusinessDatesForComparison`** in `app/utils/workingDays.ts` (same length sequence of earlier business days).

### Chunked Supabase reads across date ranges

`fetchByContiguousRanges` in `app/utils/supabaseWorkingDayQuery.ts` splits a list of dates into contiguous ranges, then for each range calls a fetcher with `dateFrom` / `dateTo` in EST. Results are concatenated. Large page sizes (e.g. 10 000–100 000) are used to reduce round trips; very wide ranges may still truncate if row counts exceed those limits.

### Primary fact table and composable

- Table: **`public.daily_deal_flow`**.
- Client access patterns: **`useDailyDealFlow`** in `app/composables/useDailyDealFlow.ts`:
  - **`fetchAll`**: paginated `select('*', { count: 'exact' })`, `order('created_at', { ascending: false })`, optional filters (status, agent, carrier, call_result, lead vendor(s), insured name, date range).
  - **`fetchAllByWorkingDates`**: runs `fetchAll` per contiguous working-day chunk via `fetchByContiguousRanges`.
- **Role scoping**: when `useAccessRole()` reports `role === 'center'` and `leadVendor` is set, queries add **`.eq('lead_vendor', leadVendor)`** so centre users only see their vendor’s rows.

### Routes outside this documentation set

The sidebar in `default.vue` is the scope boundary. These routes exist in the app but are **not** covered by the eight area documents above (unless you extend the set): `/login`, `/customers`, `/inbox`, `/dashboard`, `/analytics` (Dashboard and Analytics entries are commented out in the sidebar but pages may still exist), and any other routes not under the menus listed in the index table.

## Document template

Each area document uses the same headings:

1. Routes covered  
2. Data sources  
3. Queries  
4. Mathematics and business rules  
5. Implementation map  
