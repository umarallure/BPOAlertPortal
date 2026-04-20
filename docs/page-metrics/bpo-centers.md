# BPOs Performance (BPO centres)

## Routes covered

- **`/bpo-centers`** — `app/pages/bpo-centers.vue`. Renders **`BpoCenterCards`** with date range and period controls. No `lead-vendors` prop → includes **all** vendors returned by data fetch (subject to role scoping in `fetchAllByWorkingDates`).

## Data sources

| Source | Purpose |
|--------|---------|
| **`center_thresholds`** | Active centre definitions, targets, tier, weights (for display and targets) |
| **`daily_deal_flow`** | Transfer / pending / DQ counts per `lead_vendor` |

## Queries

### Thresholds

```text
from('center_thresholds')
  .select('*')
  .eq('is_active', true)
```

Optional: if **`leadVendors`** prop is passed (non-empty array), **`.in('lead_vendor', leadVendors)`**.

### Deal flow (current and previous periods)

For **current** and **previous** working-day date lists (same pattern as Score Board):

- **`getWorkingDatesBetween(range.start, range.end, { excludeSaturday: true })`**
- **`getPreviousBusinessDatesForComparison(currentWorkingDates, { excludeSaturday: true })`**

Then **`fetchAllByWorkingDates`** twice with `limit: 10000`, `offset: 0`, and optional **`leadVendors`** → `.in('lead_vendor', …)` inside `fetchAll`.

## Mathematics and business rules

### Row inclusion

- Rows where **`retention_agent`** is non-empty (after trim) are **excluded** from BPO centre aggregation (`isRetentionRecord`).

### Per-vendor aggregates (current and previous windows)

For each `lead_vendor` (default `'Unknown'` if null):

| Field | Increment rule |
|-------|----------------|
| **totalTransfers** | +1 per row |
| **pendingApproval** | +1 if `status === 'Pending Approval'` |
| **dqCount** | +1 if `status` is **`Returned To Center - DQ`**, **`DQ'd Can't be sold`**, or **`GI - Currently DQ`** |

### Ratios (current window, per vendor)

- **approvalRatio** (percentage): if `totalTransfers > 0`, **`round((pendingApproval / totalTransfers) * 1000) / 10`** (one decimal); else 0.
- **dqRate** (percentage): if `totalTransfers > 0`, **`round((dqCount / totalTransfers) * 1000) / 10`**; else 0.

### Trend

- **`trend`** = **`calculatePercentageChange(current.totalTransfers, previous.totalTransfers)`** (same edge rule as Score Board: prior 0 → 100 or 0).

### Raw performance score (before normalisation)

```text
rawScore = (pendingApproval * 3) + (totalTransfers * 1) - (dqCount * 2)
```

(`pendingApproval` is the variable name in code; it counts **Pending Approval** status rows.)

### Normalised performance score (1–100)

Across **all centres present in the threshold map** (each threshold row gets an entry even if no transfers):

1. Compute **`rawScore`** for each.
2. **`minScore = min(all raw scores)`**, **`maxScore = max(all raw scores)`**, **`scoreRange = maxScore - minScore`**.
3. If **`scoreRange > 0`**: **`normalised = ((rawScore - minScore) / scoreRange) * 99 + 1`**.
4. Else if **`rawScore > 0`**: **`normalised = 100`**.
5. Else: **`normalised = 1`** (initial default).
6. Stored **`performanceScore`** = **`round(normalised * 10) / 10`**.

### Performance category (colour band)

Inputs: **`performanceScore`**, **`approvalRatio`**, **`dqRate`**, **`threshold`**, **`totalTransfers`**.

1. If **`totalTransfers === 0`** → **`gray`**.
2. Else if **`performanceScore >= 80`** → **`green`**.
3. Else if **`performanceScore < 60`** → **`red`**.
4. Else → **`yellow`**.

**Note:** `approvalRatio`, `dqRate`, and `threshold` are passed into **`getPerformanceCategory`** but the current implementation only branches on **score** and **totalTransfers** (threshold fields such as `max_dq_percentage` are **not** used in this function).

### Target progress

- **`targetProgress`** = **`round((totalTransfers / threshold.daily_transfer_target) * 100)`** (percentage of daily transfer target; not capped in code).

### Ranking and display order

- Centres sorted by **`performanceScore`** descending.
- **`rank`** = 1-based index after sort.
- UI groups: **green**, then **yellow**, then **red**, then **gray** (each section collapsible).

## Implementation map

- `app/pages/bpo-centers.vue`
- `app/components/bpo/BpoCenterCards.vue`
- `app/components/bpo/BpoCenterCard.vue` (presentation)
- `app/composables/useDailyDealFlow.ts`
- `app/utils/index.ts` — `calculatePercentageChange`, `formatDateEST`
- `app/utils/workingDays.ts`
- `app/utils/supabaseWorkingDayQuery.ts`
