# Score Board

## Routes covered

- **`/`** — `app/pages/index.vue` (title “Score Board”). Renders **`AnalyticsStats`** and **`AnalyticsRates`** with optional **Retention Stats** toggle (`retentionOnly`). No `leadVendors` prop — uses **all** lead vendors subject to composable role scoping.

## Data sources

| Source | Purpose |
|--------|---------|
| Supabase table **`daily_deal_flow`** | All aggregates and rates |
| Composable **`useDailyDealFlow`** | `fetchAllByWorkingDates` |

## Queries

### Working-day window

1. **`getWorkingDatesBetween(range.start, range.end, { excludeSaturday: true })`** → list of `Date` objects (Mon–Fri only).
2. **`getPreviousBusinessDatesForComparison(currentBusinessDates, { excludeSaturday: true })`** → same-length prior business-day list for **week-over-week style** comparison in key metrics.

### Fetching rows (`AnalyticsStats`)

- Calls **`fetchAllByWorkingDates`** twice:
  - **Current**: `dates: currentBusinessDates`, `limit: 10000`, `offset: 0`.
  - **Previous**: same with `previousBusinessDates`.
- No extra column projection — full rows (`select('*')` inside `fetchAll`).
- **Centre role**: if the user is a centre user, `fetchAll` applies `.eq('lead_vendor', leadVendor)` automatically.

### Fetching rows (`AnalyticsRates`)

- Single **`fetchAllByWorkingDates`** for **current** working dates only (no prior period in this component).
- Same limit/offset defaults.

### Row filters (retention vs non-retention)

Applied **after** fetch, in both components:

- **Retention record**: `retention_agent` is non-null, non-undefined, and **not** empty after `String(v).trim()`.
- **`retentionOnly === false` (default)**: keep rows where **not** a retention record.
- **`retentionOnly === true`**: keep **only** retention records.

## Mathematics and business rules

### Key metrics cards (`AnalyticsStats` → `app/utils/index.ts`)

Counts use **`calculateMetricsFromData(data, count)`** where **`count` is passed as `filteredCurrentData.length`** (so **total transfers equals filtered row count**, and status filters use the same array).

Definitions on the **filtered** current-period array:

| Metric | Rule |
|--------|------|
| **Total transfers** | `filteredCurrentData.length` |
| **Pending approval** | Rows with `status === 'Pending Approval'` |
| **Underwriting** | Rows with `call_result === 'Underwriting'` |
| **Approved** | `pendingApprovalCount - underwritingCount` (not clamped in `calculateMetricsFromData`) |
| **GI - Currently DQ** | Rows with `status === 'GI - Currently DQ'` |

**Period-over-period % change** on each metric uses **`calculatePercentageChange(today, yesterday)`**:

- If **yesterday value is 0**: returns **100** if today &gt; 0, else **0**.
- Else: **`round(((today - yesterday) / yesterday) * 100)`** (integer).

**Retention-only mode** additionally:

- Counts **Fixes** = rows whose `status` is in **`Pending Failed Payment Fix`**, **`Fulfilled carrier requirements`**.
- Replaces the **GI - Currently DQ** card with **Fixes** (same slot in `buildStatsFromMetrics` flow): value = fixes count; change = % change of fixes vs previous period.

Displayed stats are built with **`buildStatsFromMetrics`** (titles: Total Transfers, Pending Approval, Underwriting, Approved, GI - Currently DQ or Fixes).

### Performance rates (`AnalyticsRates`)

Let **filteredData** be rows after retention filter. **`totalTransfers = filteredData.length`**.

| Rate | Numerator | Denominator | Display |
|------|-----------|-------------|---------|
| **Approval rate** | `status === 'Pending Approval'` | `totalTransfers` | If denominator 0 → 0%; else `(numerator / denominator) * 100`; show **`round(rate * 10) / 10`** |
| **Callback rate** | `status` in `Needs BPO Callback` **or** `Incomplete Transfer` | **`nonPendingCount = totalTransfers - approvalCount`** where `approvalCount` = pending approval count | If `nonPendingCount` ≤ 0 → 0%; else `(needsCallbackCount / nonPendingCount) * 100`; same one-decimal rounding |
| **DQ rate** (non-retention) | `status` in `Returned To Center - DQ`, `DQ'd Can't be sold`, `GI - Currently DQ` | **`nonPendingCount`** | Same as callback |
| **Fixes rate** (retention) | Rows with `status` in `Pending Failed Payment Fix`, `Fulfilled carrier requirements` | `totalTransfers` | Same one-decimal rounding |
| **Underwriting rate** | `call_result === 'Underwriting'` | **`approvalCount`** (pending approval) | If `approvalCount` 0 → 0%; else `(underwritingCount / approvalCount) * 100`; same rounding |

**Note:** The inline comment in code for callback rate describes a different fraction; the **implemented** formula is **`needsCallbackCount / nonPendingCount`** as above.

### Status literals (exact strings for pending / DQ family)

Use these exact values when reconciling:

- Pending approval: **`Pending Approval`**
- Callback numerator: **`Needs BPO Callback`**, **`Incomplete Transfer`**
- DQ (rates): **`Returned To Center - DQ`**, **`DQ'd Can't be sold`**, **`GI - Currently DQ`**
- Retention fixes: **`Pending Failed Payment Fix`**, **`Fulfilled carrier requirements`**

## Implementation map

- `app/pages/index.vue`
- `app/components/analytics/AnalyticsStats.vue`
- `app/components/analytics/AnalyticsRates.vue`
- `app/composables/useDailyDealFlow.ts`
- `app/utils/index.ts` — `calculateMetricsFromData`, `calculateMetricsWithComparison`, `calculatePercentageChange`, `buildStatsFromMetrics`, `formatDateEST`
- `app/utils/workingDays.ts` — working-day lists and prior comparison
- `app/utils/supabaseWorkingDayQuery.ts` — `fetchByContiguousRanges`
