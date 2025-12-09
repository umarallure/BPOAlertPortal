<script setup lang="ts">
import { DateFormatter } from '@internationalized/date'
import HomeDateRangePicker from '~/components/home/HomeDateRangePicker.vue'
import type { Range } from '~/types'
import type { AlertRule } from '~/types'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'

const supabase = useSupabaseClient()
const { fetchAll } = useDailyDealFlow()
const toast = useToast()

interface CenterThreshold {
  id: string
  center_name: string
  lead_vendor: string
  tier: 'A' | 'B' | 'C'
  daily_transfer_target: number
  daily_sales_target: number
  max_dq_percentage: number
  min_approval_ratio: number
  underwriting_threshold: number
  is_active: boolean
  slack_webhook_url?: string
}

interface CenterMetrics {
  center: CenterThreshold
  salesCount: number
  totalTransfers: number
  dqRate: number
  approvalRate: number
  lastSaleTime: Date | null
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')

const loading = ref(false)
const triggering = ref<string | null>(null)
const centers = ref<CenterThreshold[]>([])
const rules = ref<AlertRule[]>([])
const metrics = ref<CenterMetrics[]>([])
const selectedCenters = ref<Set<string>>(new Set())
const bulkTriggering = ref(false)
const rowSelection = ref({})
const columnVisibility = ref()
// Alert type selection removed from UI — triggers will pick the first available rule by default
const dateRange = ref<Range>({ start: new Date(), end: new Date() })
// vendor filter removed per request — alerts page only exposes status/date filters now

// UI-only alert type selector: we'll render options listed by the user
// (no query behavior yet — you'll provide the queries for each selection later)
const alertType = ref('all')
const alertTypeOptions = [
  { label: 'All Centers', value: 'all' },
  { label: 'High DQ rate', value: 'high_dq' },
  { label: 'Low approval ratio', value: 'low_approval' },
  { label: 'Low sales volume', value: 'low_sales' },
  { label: 'Underwriting threshold', value: 'underwriting_threshold' },
  { label: 'Zero sales for the day', value: 'zero_sales' },
  { label: 'Below Threshold Duration', value: 'below_threshold_duration' },
  { label: 'Milestone Achievement', value: 'milestone_achievement' }
]

const dateFormatter = new DateFormatter('en-US', {
  hour: 'numeric',
  minute: 'numeric',
  hour12: true
})

const formatDate = (date: Date) => date.toISOString().split('T')[0]

// Load initial data
const loadData = async () => {
  loading.value = true
  try {
    // 1. Fetch Centers
    const { data: centersData } = await supabase
      .from('center_thresholds')
      .select('*')
      .eq('is_active', true)
      .order('center_name')
    
    if (centersData) centers.value = centersData

    // 2. Fetch Rules
    const { data: rulesData } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('is_active', true)
      .order('rule_name')

    if (rulesData) {
      rules.value = rulesData
    }

    // 3. Fetch Today's Stats
    // Build filter object for fetchAll (same behavior as Daily Deal Flow)
    const today = new Date().toISOString().split('T')[0]
    const filterObj: any = { limit: 10000 }

    // Date filters
    if (dateRange.value?.start && dateRange.value?.end) {
      filterObj.dateFrom = formatDate(dateRange.value.start)
      filterObj.dateTo = formatDate(dateRange.value.end)
    } else {
      // default to today
      filterObj.date = today
    }

    // (status filter removed) — loadData will fetch for the selected date range only
    // (removed carrier/agent/callResult/leadVendor filters)

    const { data: flowData, error } = await fetchAll(filterObj)

    if (error) throw error

    // Calculate Metrics
    const metricsMap = new Map<string, CenterMetrics>()
    
    // Initialize metrics for all centers
    centers.value.forEach(center => {
      metricsMap.set(center.lead_vendor, {
        center,
        salesCount: 0,
        totalTransfers: 0,
        dqRate: 0,
        approvalRate: 0,
        lastSaleTime: null
      })
    })

    // Process flow data
    if (flowData) {
      // Group by lead_vendor
      const grouped = flowData.reduce((acc, curr) => {
        const vendor = curr.lead_vendor || 'Unknown'
        if (!acc[vendor]) acc[vendor] = []
        acc[vendor].push(curr)
        return acc
      }, {} as Record<string, any[]>)

      // Update metrics
      Object.entries(grouped).forEach(([vendor, items]) => {
        const centerMetric = metricsMap.get(vendor)
        if (centerMetric) {
          const total = items.length
          const sales = items.filter(i => 
            (i.status && i.status.toLowerCase().includes('sale')) || 
            (i.status && i.status.toLowerCase().includes('pending approval'))
          )
          const dqs = items.filter(i => 
            (i.status && i.status.toLowerCase().includes('dq')) || 
            (i.call_result && i.call_result.toLowerCase().includes('dq'))
          )
          const approvals = items.filter(i => 
            i.status && i.status.toLowerCase().includes('sale')
          )

          // Find last sale time
          let lastSale = null
          if (sales.length > 0) {
            sales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            lastSale = new Date(sales[0].created_at)
          }

          centerMetric.totalTransfers = total
          centerMetric.salesCount = sales.length
          centerMetric.dqRate = total > 0 ? (dqs.length / total) * 100 : 0
          centerMetric.approvalRate = total > 0 ? (approvals.length / total) * 100 : 0
          centerMetric.lastSaleTime = lastSale
        }
      })
    }

    metrics.value = Array.from(metricsMap.values())

  } catch (e: any) {
    toast.add({ title: 'Error loading data', description: e.message, color: 'red' })
  } finally {
    loading.value = false
  }
}

// Filter metrics based on search only
// No client-side center search — show all metrics fetched from server
const filteredMetrics = computed(() => metrics.value)

// rules is used directly for the alert dropdown (no custom UI filtering)

const triggerAlert = async (centerId: string) => {
  // Use the first available active rule as default when no UI selector
  const rule = rules.value[0]
  if (!rule) {
    toast.add({ title: 'Error', description: 'No alert rules configured', color: 'red' })
    return
  }

  triggering.value = centerId
  try {
    const session = (await supabase.auth.getSession()).data.session

    await $fetch('https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/check-alerts', {
      method: 'POST',
      body: {
        center_id: centerId,
        rule_id: rule.id,
        force: true
      },
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    })

    toast.add({ title: 'Alert Triggered', description: 'Notification sent to Slack', color: 'green' })
  } catch (e: any) {
    toast.add({ title: 'Error triggering alert', description: e.message, color: 'red' })
  } finally {
    triggering.value = null
  }
}

const triggerBulkAlerts = async () => {
  if (selectedCenters.value.size === 0) return
  
  bulkTriggering.value = true
  try {
    const session = (await supabase.auth.getSession()).data.session
    const centerIds = Array.from(selectedCenters.value)
    const rule = rules.value[0]
    if (!rule) {
      toast.add({ title: 'Error', description: 'No alert rules configured', color: 'red' })
      return
    }
    
    await $fetch('https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/bulk-alerts', {
      method: 'POST',
      body: {
        center_ids: centerIds,
        rule_id: rule.id,
        force: true
      },
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    })

    toast.add({ 
      title: 'Bulk Alerts Triggered', 
      description: `Notifications sent to ${centerIds.length} centers`, 
      color: 'green' 
    })
    
    // Clear selection after successful trigger
    selectedCenters.value.clear()
    rowSelection.value = {}
  } catch (e: any) {
    toast.add({ title: 'Error triggering bulk alerts', description: e.message, color: 'red' })
  } finally {
    bulkTriggering.value = false
  }
}

const toggleCenterSelection = (centerId: string) => {
  if (selectedCenters.value.has(centerId)) {
    selectedCenters.value.delete(centerId)
  } else {
    selectedCenters.value.add(centerId)
  }
}

const selectAllCenters = () => {
  const newSelection: Record<string, boolean> = {}
  filteredMetrics.value.forEach((m, idx) => {
    newSelection[idx] = true
  })
  rowSelection.value = newSelection
}

const clearSelection = () => {
  rowSelection.value = {}
}

// Watch for changes in row selection to update the internal selectedCenters map
watch(rowSelection, (newSelection) => {
  const selected = new Set<string>()
  Object.entries(newSelection).forEach(([idx, isSelected]) => {
    if (isSelected) {
      const metric = filteredMetrics.value[parseInt(idx)]
      if (metric) {
        selected.add(metric.center.id)
      }
    }
  })
  selectedCenters.value = selected
}, { deep: true })

// Watch filters and reload data when they change
// status filter removed

// removed watchers for carrier/callResult/agent/leadVendor filters

watch(() => dateRange.value, async (val) => {
  await loadData()
}, { deep: true })

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'A': return 'border-green-500'
    case 'B': return 'border-yellow-500'
    case 'C': return 'border-red-500'
    default: return 'border-gray-200'
  }
}

const getTierBadgeColor = (tier: string) => {
  switch (tier) {
    case 'A': return 'green'
    case 'B': return 'yellow'
    case 'C': return 'red'
    default: return 'gray'
  }
}

function getRowItems(row: Row<CenterMetrics>) {
  return [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'Trigger Alert',
      icon: 'i-lucide-bell',
      disabled: !row.original.center.slack_webhook_url,
      onSelect() {
        triggerAlert(row.original.center.id)
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'View Details',
      icon: 'i-lucide-list'
    }
  ]
}

const columns: TableColumn<CenterMetrics>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Select row'
      })
  },
  {
    accessorKey: 'center.center_name',
    header: 'Center Name',
    cell: ({ row }) => {
      return h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, row.original.center.center_name),
        h('p', { class: 'text-xs text-muted' }, row.original.center.lead_vendor)
      ])
    }
  },
  {
    accessorKey: 'center.tier',
    header: 'Tier',
    cell: ({ row }) => {
      return h(UBadge, { color: getTierBadgeColor(row.original.center.tier), variant: 'subtle', size: 'xs' }, () =>
        `Tier ${row.original.center.tier}`
      )
    }
  },
  {
    accessorKey: 'salesCount',
    header: 'Sales',
    cell: ({ row }) => {
      const color = row.original.salesCount === 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'
      return h('div', undefined, [
        h('span', { class: `font-bold ${color}` }, `${row.original.salesCount}`),
        h('span', { class: 'text-xs text-gray-400 ml-1' }, `/ ${row.original.center.daily_sales_target}`)
      ])
    }
  },
  {
    accessorKey: 'totalTransfers',
    header: 'Transfers',
    cell: ({ row }) => {
      return h('div', undefined, [
        h('span', { class: 'font-bold text-gray-900 dark:text-white' }, `${row.original.totalTransfers}`),
        h('span', { class: 'text-xs text-gray-400 ml-1' }, `/ ${row.original.center.daily_transfer_target}`)
      ])
    }
  },
  {
    accessorKey: 'dqRate',
    header: 'DQ Rate',
    cell: ({ row }) => {
      const color = row.original.dqRate > row.original.center.max_dq_percentage ? 'text-red-500' : 'text-gray-900 dark:text-white'
      return h('div', undefined, [
        h('span', { class: `font-bold ${color}` }, `${row.original.dqRate.toFixed(1)}%`),
        h('span', { class: 'text-xs text-gray-400 ml-1' }, `max ${row.original.center.max_dq_percentage}%`)
      ])
    }
  },
  {
    accessorKey: 'approvalRate',
    header: 'Approval Rate',
    cell: ({ row }) => {
      const color = row.original.approvalRate < row.original.center.min_approval_ratio ? 'text-red-500' : 'text-gray-900 dark:text-white'
      return h('div', undefined, [
        h('span', { class: `font-bold ${color}` }, `${row.original.approvalRate.toFixed(1)}%`),
        h('span', { class: 'text-xs text-gray-400 ml-1' }, `min ${row.original.center.min_approval_ratio}%`)
      ])
    }
  },
  {
    accessorKey: 'lastSaleTime',
    header: 'Last Sale',
    cell: ({ row }) => {
      if (row.original.lastSaleTime) {
        return h('span', { class: 'text-sm text-gray-600 dark:text-gray-400' }, dateFormatter.format(row.original.lastSaleTime))
      }
      return h('span', { class: 'text-sm text-red-500 font-medium' }, 'No sales')
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'flex items-center gap-2' },
        [
          h(UButton, {
            loading: triggering.value === row.original.center.id,
            disabled: !row.original.center.slack_webhook_url,
            color: row.original.center.slack_webhook_url ? 'primary' : 'gray',
            variant: 'ghost',
            icon: 'i-heroicons-bell',
            size: 'xs',
            onClick: () => triggerAlert(row.original.center.id),
            label: row.original.center.slack_webhook_url ? 'Trigger' : 'No Webhook'
          })
        ]
      )
    }
  }
]

onMounted(() => {
  loadData()
})
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Alerts & Notifications">
      <template #right>
        <UButton
          icon="i-heroicons-arrow-path"
          color="gray"
          variant="ghost"
          :loading="loading"
          @click="loadData"
        />
      </template>
    </UDashboardNavbar>

    <div class="flex flex-col gap-4 p-4">
      <!-- Filter Controls with Search and Alert Selector -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">

          <!-- Date Range -->
          <HomeDateRangePicker v-model="dateRange" />

          <!-- UI-only Alert Type dropdown — selection does not apply filters until you provide the queries -->
          <USelect
            v-model="alertType"
            :items="alertTypeOptions"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Alert Type"
            class="min-w-64"
          />
          <!-- Removed center search and vendor/agent/carrier/call-result filters per request -->
          
          <!-- Alert type UI removed — triggers will use the first active rule by default -->
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ Array.from(rowSelection).filter(([_, selected]) => selected).length }} selected
          </span>
          <UButton
            v-if="Array.from(rowSelection).filter(([_, selected]) => selected).length > 0"
            color="red"
            variant="ghost"
            size="sm"
            @click="clearSelection"
          >
            Clear
          </UButton>
          <UButton
            color="primary"
            variant="outline"
            size="sm"
            @click="selectAllCenters"
          >
            Select All
          </UButton>
          <UButton
            :loading="bulkTriggering"
            :disabled="Array.from(rowSelection).filter(([_, selected]) => selected).length === 0"
            color="primary"
            size="sm"
            @click="triggerBulkAlerts"
          >
            Send Bulk Alerts ({{ Array.from(rowSelection).filter(([_, selected]) => selected).length }})
          </UButton>
        </div>
      </div>

      <!-- Alert Info Banner removed (no Alert Type selector in UI) -->

      <!-- Grid Table -->
      <div class="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
        <!-- vertical scrolling area for table body so header stays visible and a scrollbar appears -->
        <div class="max-h-[60vh] overflow-y-auto pr-2">
          <div class="min-w-full">
            <UTable
          v-model:row-selection="rowSelection"
          :data="filteredMetrics"
          :columns="columns"
          :loading="loading"
          :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-3 px-4 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r font-medium text-gray-700 dark:text-gray-200',
            td: 'border-b border-default px-4 py-3',
            separator: 'h-0'
          }"
            />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredMetrics.length === 0 && !loading" class="flex flex-col items-center justify-center py-12 text-gray-500">
        <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-500 mb-3" />
        <p class="text-lg font-medium">All Good!</p>
        <p class="text-sm">No centers found matching your search.</p>
      </div>

      <!-- Results Summary -->
      <div class="text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 pt-4">
        <span class="font-medium">{{ filteredMetrics.length }}</span> centers displayed
      </div>
    </div>
  </UDashboardPanel>
</template>
