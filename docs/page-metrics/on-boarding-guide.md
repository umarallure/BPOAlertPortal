# On Boarding Guide

## Routes covered

| Path | File | Data |
|------|------|------|
| `/on-boarding-guide/carriers` | `app/pages/on-boarding-guide/carriers/index.vue` | List from **`carriers`** |
| `/on-boarding-guide/carriers/:carrier_name` | `app/pages/on-boarding-guide/carriers/[carrier_name].vue` | Single row from **`carriers`** |
| `/on-boarding-guide/ghl-walkthrough` | `app/pages/on-boarding-guide/ghl-walkthrough.vue` | Supabase Storage |
| `/on-boarding-guide/docs` | `app/pages/on-boarding-guide/docs.vue` | Supabase Storage |
| `/on-boarding-guide/underwriting-instructions` | `app/pages/on-boarding-guide/underwriting-instructions.vue` | Supabase Storage |
| `/on-boarding-guide` (index) | `app/pages/on-boarding-guide/index.vue` | Navigation only (no analytics in scope) |

The sidebar default link targets **`/on-boarding-guide/carriers`**.

## Data sources

| Source | Routes |
|--------|--------|
| Table **`carriers`** | Carriers index and detail |
| Storage bucket **`BPOAlertPortal`** | GHL walkthrough, Docs, Underwriting videos |

## Queries

### Carriers list

```text
from('carriers')
  .select('id, carrier_name, carrier_code, is_active, display_order, notes')
  .order('display_order', { ascending: true })
  .order('carrier_name', { ascending: true })
```

### Carrier detail

```text
from('carriers')
  .select('id, carrier_name, carrier_code, is_active, display_order, notes')
  .eq('carrier_name', decodedRouteParam)
  .maybeSingle()
```

`carrier_name` comes from **`decodeURIComponent(route.params.carrier_name)`**.

### Storage (shared pattern)

Each asset page defines:

| Page | `FOLDER` constant |
|------|-------------------|
| GHL walkthrough | `ghl-walkthrough/videos` |
| Docs | `docs/files` |
| Underwriting instructions | `underwriting-instructions/videos` |

**List:**

```text
storage.from('BPOAlertPortal').list(FOLDER, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
```

**Signed URLs:** `createSignedUrl` (and metadata paths) with TTL **`60 * 60`** seconds (1 hour) where implemented.

**Remove:** `storage.from('BPOAlertPortal').remove([assetPath])` with path **`${FOLDER}/${fileName}`**.

Upload flows use **`AssetUploadModal`** with **`:bucket`** and **`:folder`** props.

**Admin-only** actions (upload/delete) are gated with **`useAccessRole()`** → **`role === 'admin'`** where present.

## Mathematics and business rules

- **No numeric KPIs** or aggregations on these routes beyond sorting and display order.
- **No `daily_deal_flow`** queries here.

## Implementation map

- `app/pages/on-boarding-guide/carriers/index.vue`
- `app/pages/on-boarding-guide/carriers/[carrier_name].vue`
- `app/pages/on-boarding-guide/ghl-walkthrough.vue`
- `app/pages/on-boarding-guide/docs.vue`
- `app/pages/on-boarding-guide/underwriting-instructions.vue`
- `app/components/onboarding/AssetUploadModal.vue`
