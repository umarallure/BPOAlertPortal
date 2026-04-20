# Reports

## Routes covered

- **`/reports/agencyperformance`** — `app/pages/reports/agencyperformance.vue` — weekly agency performance (executive summary, KPI rates, top performers, PDF export).
- **`/reports/callcenterperformance`** — `app/pages/reports/callcenterperformance.vue` — per–call-centre metrics from thresholds + deal flow, feedback CRUD, PDF export.

## Data sources

| Source | Agency | Call centre |
|--------|--------|---------------|
| **`daily_deal_flow`** | Yes (lite columns) | Yes (lite columns) |
| **`center_thresholds`** | No | Yes (list + fallback) |
| **`call_center_feedback`** | No | Yes |

## Queries

### Shared: deal flow lite by working dates

Both reports use **`fetchDealFlowLiteByWorkingDates`** pattern:

- Split dates with **`fetchByContiguousRanges`** (`app/utils/supabaseWorkingDayQuery.ts`), **`pageSize` 100000** in agency; call centre uses same helper with **`pageSize: 100000`** in the fetcher options.
- Per contiguous range:

```text
from('daily_deal_flow')
  .select('lead_vendor,status,call_result', { count: 'exact' })
  .gte('date', dateFrom)
  .lte('date', dateTo)
  .range(0, 99999)
```

- **Current** and **previous** business-day lists: **`getWorkingDatesBetween`** and **`getPreviousBusinessDatesForComparison`** with **`excludeSaturday: true`** (same as Score Board).

**Agency** fetches current and previous in **parallel** (`Promise.all`).

### Agency-specific

- Row counts for rates use **`currentCount` / `previousCount`** from fetch results; aggregates also use **filtered arrays** (`currentData`, `previousData`).

### Call centre: thresholds

```text
from('center_thresholds')
  .select('id,center_name,lead_vendor,is_active')
  .order('center_name', { ascending: true })
```

If error or **empty**, centres are **synthesised** from distinct non-empty `lead_vendor` values in current + previous deal-flow data ( **`id` = vendor string** for that fallback).

### Call centre: feedback

**Load** (for selected centre IDs and report date range):

```text
from('call_center_feedback')
  .select('id,center_id,title,description,feedback_by,created_at')
  .in('center_id', centerIds)
  .gte('created_at', dateFrom + 'T00:00:00')
  .lte('created_at', dateTo + 'T23:59:59.999')
  .order('created_at', { ascending: false })
```

**Insert** (save modal):

```text
insert({ center_id, title, description, feedback_by: 'admin' })
```

## Mathematics and business rules

### DQ status set (both reports)

Exact strings:

- **`Returned To Center - DQ`**
- **`DQ'd Can't be sold`**
- **`GI - Currently DQ`**

### Vendor rollup `groupByVendor` (both)

Per row in lite data:

- **transfers**: +1
- **pending**: +1 if `status === 'Pending Approval'`
- **underwriting**: +1 if `call_result === 'Underwriting'`
- **dq**: +1 if status in DQ set above
- **callbacks**: +1 if `status === 'Needs BPO Callback'` or **`Incomplete Transfer`**

### Agency: executive summary inputs

Let **`totalTransfers`** = **count** from current fetch (not only array length). Same for previous.

From **current** filtered arrays:

- **`pendingApproval`** = count `status === 'Pending Approval'`
- **`underwriting`** = count `call_result === 'Underwriting'`
- **`approved`** = **`max(pendingApproval - underwriting, 0)`**
- **`dqCases`** = count statuses in DQ set
- **`nonPendingCount`** = **`totalTransfers - pendingApproval`**
- **`needsCallbackCount`** = callback numerator above

**Rates (current period):**

| KPI | Formula | Rounding in table |
|-----|---------|-------------------|
| Approval rate | `(pendingApproval / totalTransfers) * 100` if transfers &gt; 0 else 0 | Display `round(rate * 10) / 10` to one decimal |
| Callback rate | `(needsCallbackCount / nonPendingCount) * 100` if `nonPendingCount > 0` else 0 | Same |
| DQ rate | `(dqCases / nonPendingCount) * 100` if `nonPendingCount > 0` else 0 | Same |
| Underwriting rate | `(underwriting / pendingApproval) * 100` if `pendingApproval > 0` else 0 | Same |

Previous period: same with `last*` variables.

**Executive summary rows** use **`calculatePercentageChange(thisWeek, lastWeek)`** for: total transfers, approved sales, pending approval, underwriting, DQ / GI cases. Display prefix **`+`** when current ≥ previous.

**Top performers:**

- **Highest transfer**: vendor with max **`transfers`** in current map.
- **Highest sales**: vendor with max **`max(pending - underwriting, 0)`**; display includes transfer count.
- **Most improved**: vendor with largest **`calculatePercentageChange(current.transfers, previous.transfers)`** among current vendors.

**PDF export** (`downloadAgencyPerformanceReportPdf`): receives week label, executive summary rows, performance rate rows (kpi, rate, formula, interpretation), top performers object.

### Call centre: per-centre metrics

For each centre row (from thresholds or fallback), match **`leadVendor`** to **`groupByVendor`** maps for current and previous.

- **Sales (this week / last week)** = **`max(pending - underwriting, 0)`** for that window.

**Metric rows** (each with thisWeek, lastWeek, delta string):

| Label | Value |
|-------|--------|
| Transfers | `transfers` |
| Sales | `max(pending - underwriting, 0)` |
| Underwriting | `underwriting` |
| DQ / GI | `dq` |

**Delta** display: **`+{calculatePercentageChange(this, last)}%`** with **`+`** when current ≥ previous (same helper as agency).

**PDF export** (`downloadCallCenterPerformanceReportPdf`): week label, per-centre metrics, feedback list per centre.

## Implementation map

- `app/pages/reports/agencyperformance.vue`
- `app/pages/reports/callcenterperformance.vue`
- `app/utils/reportExport.ts` — PDF helpers
- `app/utils/supabaseWorkingDayQuery.ts`
- `app/utils/workingDays.ts`
- `app/utils/index.ts` — `calculatePercentageChange`, `formatDateEST`
