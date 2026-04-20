# Daily Deal Flow

## Routes covered

- **`/daily-deal-flow`** — `app/pages/daily-deal-flow.vue`. Interactive table: filters, pagination, CRUD actions via **`useDailyDealFlow().fetchAll`** (and related methods where wired in the page).

## Data sources

| Source | Purpose |
|--------|---------|
| Supabase **`daily_deal_flow`** | Table rows for the grid |
| **`useDailyDealFlow`** | `fetchAll`, `fetchById`, `create`, `update`, `remove`, `subscribe`, **`getMetrics`** (helper not necessarily used by this page) |

## Queries

### List / pagination (`fetchAll`)

Built in `app/composables/useDailyDealFlow.ts`:

- **Base**: `.from('daily_deal_flow').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)`.
- **Default page size**: 1000 in composable; the **page** passes `limit` / `offset` from its own `pageSize` (100) and `currentPage`.
- **Centre user**: if `role === 'center'` and `leadVendor` is set, **`.eq('lead_vendor', leadVendor)`**.

Optional filters (only if provided and not `'all'` where applicable):

| Parameter | PostgREST filter |
|-----------|------------------|
| `status` | `.eq('status', value)` |
| `agent` | `.eq('agent', value)` |
| `carrier` | `.eq('carrier', value)` |
| `callResult` | `.eq('call_result', value)` |
| `leadVendors` (array) | `.in('lead_vendor', leadVendors)` |
| `leadVendor` (single) | `.eq('lead_vendor', leadVendor)` |
| `insuredName` | `.ilike('insured_name', '%' + value + '%')` |
| `dateFrom` / `dateTo` | `.gte('date', dateFrom)` / `.lte('date', dateTo)` (combinations as implemented) |

### Other composable methods (available to the feature)

- **`fetchById`**: `select('*').eq('id', id).single()`.
- **`create`**: `insert(entry).select().single()`.
- **`update`**: `update(updates).eq('id', id).select().single()`.
- **`remove`**: `delete().eq('id', id)`.
- **`subscribe`**: realtime channel on `public.daily_deal_flow` for `*`.
- **`fetchAllByWorkingDates`**: used on **other** pages; documented in [README](./README.md). The Daily Deal Flow page uses **calendar range → `dateFrom` / `dateTo`** on `fetchAll` instead.

## Mathematics and business rules

### Table-level

- **No aggregate KPIs** are computed on this route beyond **total row count** from Supabase **`count: 'exact'`** for pagination.
- Sorting is **always** `created_at` descending in `fetchAll`.

### Helper: `getMetrics(date?)` (same composable)

Used elsewhere (e.g. single-day dashboard-style snapshots); documented here for completeness. Target date defaults to **`formatDateEST(new Date())`**.

Query: `select('*').eq('date', targetDate)`.

On the returned rows:

| Metric | Formula |
|--------|---------|
| **totalTransfers** | `data.length` |
| **totalSales** | Count `status === 'Pending Approval'` |
| **totalUnderwriting** | Count `status === 'Pending Approval' && call_result === 'Underwriting'` |
| **approvalRate** | If `totalTransfers > 0`: `(totalSales / totalTransfers) * 100`, else 0 |
| **callbackRate** | `callbacks` = count `is_callback`; if `totalTransfers > 0`: `(callbacks / totalTransfers) * 100`, else 0 |
| **dqRate** | DQ statuses: **`DQ`**, **`Quality Issue`**, **`Failed Quality Check`**; if `totalTransfers > 0`: `(dqCount / totalTransfers) * 100`, else 0 |

**Note:** These DQ status strings **differ** from the Score Board / reports DQ family (`Returned To Center - DQ`, etc.). Treat `getMetrics` as a **separate** definition for any screen that calls it.

## Implementation map

- `app/pages/daily-deal-flow.vue`
- `app/composables/useDailyDealFlow.ts`
- `app/composables/useAccessRole.ts` — centre scoping
- `app/utils/index.ts` — `formatDateEST` (composable)
