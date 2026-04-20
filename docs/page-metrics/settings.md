# Settings

## Routes covered

Layout parent: **`app/pages/settings.vue`** with nested **`NuxtPage`**. Toolbar tabs link to child routes:

| Path | File | Purpose |
|------|------|---------|
| `/settings` | `app/pages/settings/index.vue` | General profile form (template / local state; **no Supabase metrics**) |
| `/settings/bpo-thresholds` | `app/pages/settings/bpo-thresholds.vue` | **`center_thresholds`** CRUD-style updates |
| `/settings/alert-rules` | `app/pages/settings/alert-rules.vue` | **`alert_rules`** + **`carrier_thresholds`** management |
| `/settings/notifications` | `app/pages/settings/notifications.vue` | Local notification toggles (**no backend queries** in file) |
| `/settings/security` | `app/pages/settings/security.vue` | Password form validation only (**no backend**) |
| `/settings/members` | `app/pages/settings/members.vue` | **`GET /api/members`** |

**Note:** The sidebar under Settings lists **General**, **BPO Thresholds**, **Alert Rules** only. **Notifications**, **Security**, and **Members** remain reachable via the settings layout navigation.

## Data sources

| Source | Routes |
|--------|--------|
| **`center_thresholds`** | BPO thresholds |
| **`alert_rules`** | Alert rules (full CRUD in alert-rules page) |
| **`carrier_thresholds`** | Per-carrier underwriting thresholds |
| **`GET /api/members`** | Members list (static demo data in server handler) |

## Queries

### BPO thresholds (`settings/bpo-thresholds.vue`)

**Load:**

```text
from('center_thresholds')
  .select('*')
  .order('tier', { ascending: true })
  .order('center_name', { ascending: true })
```

**Update row:**

```text
from('center_thresholds')
  .update({
    tier, daily_transfer_target, daily_sales_target,
    max_dq_percentage, min_approval_ratio,
    transfer_weight, approval_ratio_weight, dq_weight,
    is_active, slack_webhook_url, slack_channel, slack_manager_id,
    updated_at: ISO timestamp
  })
  .eq('id', center.id)
```

### Alert rules (`settings/alert-rules.vue`)

**Load rules:**

```text
from('alert_rules')
  .select('*')
  .order('rule_name')
```

**Load carriers:**

```text
from('carrier_thresholds')
  .select('*')
  .order('carrier_name')
```

**Rule save:** `insert` or `update` on **`alert_rules`** (see file for full field set).

**Carrier save:** `insert` or `update` on **`carrier_thresholds`**.

**Delete carrier:**

```text
from('carrier_thresholds').delete().eq('id', id)
```

### Alerts config (`settings/alerts-config.vue`)

Parallel pattern to alert-rules (simplified UI):

- **Load:** `alert_rules` `select('*')` ordered by `rule_name`; `carrier_thresholds` `select('*')` ordered by `carrier_name`.
- **Rule update:** `update` on `alert_rules` — `alert_message_template`, `condition_settings`, `is_active`, `updated_at`.
- **Carrier:** `insert` / `update` / `delete` on `carrier_thresholds` as in alert-rules.

### Members (`settings/members.vue`)

```text
useFetch<Member[]>('/api/members', { default: () => [] })
```

Server: **`server/api/members.ts`** returns a **hard-coded** array (template data), not Supabase.

## Mathematics and business rules

- **No deal-flow aggregates** on these settings pages.
- Threshold fields (**`max_dq_percentage`**, **`min_approval_ratio`**, **`daily_sales_target`**, **`underwriting_threshold`** on centres, **`underwriting_threshold`** on carriers) are **inputs** to other areas (e.g. [alerts.md](./alerts.md), [bpo-centers.md](./bpo-centers.md)); they are **not recomputed** here.

## Implementation map

- `app/pages/settings.vue`
- `app/pages/settings/index.vue`
- `app/pages/settings/bpo-thresholds.vue`
- `app/pages/settings/alert-rules.vue`
- `app/pages/settings/alerts-config.vue`
- `app/pages/settings/notifications.vue`
- `app/pages/settings/security.vue`
- `app/pages/settings/members.vue`
- `server/api/members.ts`
