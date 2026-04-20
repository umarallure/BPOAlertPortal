# Alerts

## Routes covered

- **`/alerts`** — `app/pages/alerts.vue`. Loads centres, rules, and **`daily_deal_flow`** over a user-selected date range; computes **per-centre metrics**; filters rows by alert type; triggers **Supabase Edge Functions** for Slack notifications (single and bulk).

## Data sources

| Source | Use |
|--------|-----|
| **`center_thresholds`** | Active centres (`is_active = true`), ordered by `center_name` |
| **`alert_rules`** | Active rules (`is_active = true`), ordered by `rule_name` |
| **`daily_deal_flow`** | All rows for selected **working dates** (Mon–Fri), via **`fetchAllByWorkingDates`** |
| **Edge Functions** (hard-coded project URL) | `check-alerts`, `bulk-alerts` |

Edge base URL in code: **`https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/`**  
Auth: **`Authorization: Bearer <supabase session access_token>`**.

## Queries

### Centres

```text
from('center_thresholds')
  .select('*')
  .eq('is_active', true)
  .order('center_name')
```

### Rules

```text
from('alert_rules')
  .select('*')
  .eq('is_active', true)
  .order('rule_name')
```

On load, if a rule with **`rule_type === 'below_threshold_duration'`** has **`condition_settings.consecutive_hours`** (number &gt; 0), the UI initialises **`belowThresholdHours`** from it.

### Deal flow

- **`getWorkingDatesBetween(dateRange.start, dateRange.end, { excludeSaturday: true })`**
- **`fetchAllByWorkingDates({ dates, limit: 10000, offset: 0 })`** — **no** status/carrier/agent filters in `loadData`.

**Centre role**: inherits **`useDailyDealFlow`** scoping (centre users may only see their `lead_vendor`).

## Mathematics and business rules

### Initialising per-centre metrics

A map is built for **every** centre from `center_thresholds`. Each entry: **`salesCount: 0`**, **`totalTransfers: 0`**, **`dqRate: 0`**, **`approvalRate: 0`**, **`lastSaleTime: null`**, **`underwritingCount: 0`**.

Rows are grouped by **`lead_vendor`** (or **`Unknown`**). For each group **only if** `metricsMap` has that vendor:

#### Sales rows (`sales`)

Rows where **`status`** (lowercased) **includes** **`'sale'`** **or** **`'pending approval'`**.

#### Approvals subset (`approvals`)

Rows where **`status`** (lowercased) **includes** **`'sale'`** only.

#### DQ rows (`dqs`)

Rows where **`status`** (lowercased) **includes** **`'dq'`** **or** **`call_result`** (lowercased) **includes** **`'dq'`**.

#### Underwriting rows

Rows where **`call_result`** (lowercased) **includes** **`'underwriting'`**.

#### Last sale time

Among **sales** rows, sort by **`created_at`** descending; **`lastSaleTime`** = **`new Date(first.created_at)`** if any.

#### Assigned metrics

- **`totalTransfers`** = `items.length`
- **`salesCount`** = `sales.length`
- **`dqRate`** = if `totalTransfers > 0` then **`(dqs.length / totalTransfers) * 100`** else **0**
- **`approvalRate`** = if `totalTransfers > 0` then **`(approvals.length / totalTransfers) * 100`** else **0**
- **`underwritingCount`** = `underwritingItems.length`

**Important:** These definitions are **string-substring based** and **not** identical to exact-status KPIs on the Score Board or Reports. Reconciliation across pages should assume **different** DQ / approval definitions here.

### Pakistan shift helper (`computePkShift`)

Used for **`hours_remaining`** and related payloads to Edge Functions. Time zone: **`Asia/Karachi`** (`formatToParts`).

- **In shift**: hour **≥ 20** or **&lt; 6** (8 pm–6 am PKT window).
- **`hours_remaining`**: minutes until 6 am, converted to hours, with **overrides** at **23:xx** PKT (30–59 min → **6.5**; 0–29 min → **7**), otherwise **ceil** to whole hours when still in default mode.
- Returns **`pkHour`**, **`pkMinute`**, **`inShift`**, **`minutesSinceShiftStart`**, **`minutesToSixAM`**, **`hours_remaining`**, **`calcMode`**.

### Filter predicates (`filteredMetrics`)

Let **`m`** be **`CenterMetrics`**, **`now`** = current time.

| Alert type key | Predicate (summary) |
|----------------|---------------------|
| **high_dq** | `totalTransfers > 0` **and** `dqRate > center.max_dq_percentage` |
| **low_approval** | `totalTransfers > 0` **and** `approvalRate < center.min_approval_ratio` |
| **low_sales** | **`calculatedPercent`** = `(salesCount / daily_sales_target) * 100` if target &gt; 0 else 0; **`belowGap`** = `calculatedPercent < lowSalesPercentageGap` (default gap 50). **Zero-sales window**: if `lastSaleTime` exists, **`hoursSinceLastSale ≥ lowSalesZeroHours`**; else if after **09:00 local** same day, hours since 09:00 ≥ `lowSalesZeroHours`; else false. **Match** = `belowGap OR zeroSalesInWindow`. |
| **underwriting_threshold** | `underwritingCount > center.underwriting_threshold` |
| **zero_sales** | `salesCount === 0` |
| **below_threshold_duration** | `salesCount < daily_sales_target`; then hours “below” from last sale or start-of-day 09:00; true if **`hoursBelow ≥ belowThresholdHours`** |
| **milestone_achievement** | `(salesCount / daily_sales_target) * 100 ≥ milestonePercentage` (75 / 100 / 125 options) |
| **sales_alert** | Display filter returns **all** rows (no narrowing) |
| **all** | Union of: high_dq, low_approval, low_sales, underwriting_threshold, zero_sales, below_threshold_duration, milestone_achievement, **sales_alert** |

**Progress update** (`isProgressUpdate`) exists in code (hours remaining 18 − current hour, sales &gt; 0, target &lt; 100%) but is **not** in the **`all`** union above.

### Edge payloads (representative)

- **Single trigger** `POST .../check-alerts` with **`center_id`**, **`rule_id`**, **`force: true`**, **`filter_values`** (varies by alert type: e.g. `percentage_gap`, `zero_sales_hours`, `hours_remaining` from **`computePkShift`**, `current_sales`, `target_sales`, `percentage`, `hours`, `time_check`, `milestone_percentage`, etc.).
- **Bulk** `POST .../bulk-alerts` with **`center_ids`**, same rule and filter pattern; per-centre maps for low sales / milestone / sales_alert as implemented.

Response handling: reads **`results`**, **`summary.successful`**, **`summary.failed`**, **`errors`** for toasts.

## Implementation map

- `app/pages/alerts.vue`
- `app/composables/useDailyDealFlow.ts`
- `app/utils/workingDays.ts`
