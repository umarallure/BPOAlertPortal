# Colombian

## Routes covered

| Path | File | Behaviour |
|------|------|-----------|
| `/colombian-score-board` | `app/pages/colombian-score-board.vue` | Same UI as Score Board with **vendor filter** and retention toggle |
| `/colombian-daily-deal-flow` | `app/pages/colombian-daily-deal-flow.vue` | Same table patterns as Daily Deal Flow but **restricted** to Colombian vendors |
| `/colombian-bpo-centers` | `app/pages/colombian-bpo-centers.vue` | Same as BPO centres page but **`BpoCenterCards`** receives **`lead-vendors`** |

## Shared vendor allow-list

All three pages define the same constant (order and spelling must match database `lead_vendor` values):

```text
['INB BPO', 'MBG', 'Alternative BPO', 'JoLu Solutions']
```

## Data sources

Identical to the non-Colombian counterparts:

- **`daily_deal_flow`** — facts
- **`center_thresholds`** — BPO cards only

## Queries

### Score Board (`colombian-score-board`)

- **`AnalyticsStats`** and **`AnalyticsRates`** receive **`:lead-vendors="COLOMBIAN_LEAD_VENDORS"`**.
- Inside **`fetchAll`**, this becomes **`.in('lead_vendor', leadVendors)`** when the array is non-empty.
- Working-day fetch, retention filter, and **all formulas** are the same as [score-board.md](./score-board.md).

### BPO centres (`colombian-bpo-centers`)

- **`BpoCenterCards`** receives **`:lead-vendors="COLOMBIAN_LEAD_VENDORS"`**.
- Threshold query: **`.in('lead_vendor', props.leadVendors)`**.
- Deal flow fetches: same **`fetchAllByWorkingDates`** with **`leadVendors`** set.
- **All maths** match [bpo-centers.md](./bpo-centers.md).

### Daily deal flow (`colombian-daily-deal-flow`)

- On load (and when filters refresh), the page adds **`filterObj.leadVendors = COLOMBIAN_LEAD_VENDORS`** so **`fetchAll`** always scopes to those four vendors (in addition to any per-row **lead vendor** filter the user selects in the UI).
- Other filters (status, agent, carrier, dates, etc.) behave like **`/daily-deal-flow`** — see [daily-deal-flow.md](./daily-deal-flow.md).

## Mathematics and business rules

No **new** formulas relative to the global pages: only the **row subset** changes via **`lead_vendor IN (…)`**.

For a full formula reference:

- Key metrics and rates → [score-board.md](./score-board.md)
- BPO scoring and categories → [bpo-centers.md](./bpo-centers.md)
- Table pagination and `getMetrics` helper → [daily-deal-flow.md](./daily-deal-flow.md)

## Implementation map

- `app/pages/colombian-score-board.vue`
- `app/pages/colombian-daily-deal-flow.vue`
- `app/pages/colombian-bpo-centers.vue`
- Shared components: `AnalyticsStats.vue`, `AnalyticsRates.vue`, `BpoCenterCards.vue`
- `app/composables/useDailyDealFlow.ts`
