<script setup lang="ts">
import { DateFormatter } from '@internationalized/date'
import HomeDateRangePicker from '~/components/home/HomeDateRangePicker.vue'
import type { Range, AlertRule } from '~/types'
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
  underwritingCount: number
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
const dateRange = ref<Range>({ start: new Date(), end: new Date() })

const alertType = ref('all')
const alertTypeOptions = [
  { label: 'All Centers', value: 'all' },
  { label: 'High DQ rate', value: 'high_dq' },
  { label: 'Low approval ratio', value: 'low_approval' },
  { label: 'Low sales volume', value: 'low_sales' },
  { label: 'Underwriting threshold', value: 'underwriting_threshold' },
  { label: 'Zero sales for the day', value: 'zero_sales' },
  { label: 'Below Threshold Duration', value: 'below_threshold_duration' },
  { label: 'Milestone Achievement', value: 'milestone_achievement' },
  { label: 'Sales Alert', value: 'sales_alert' }
]

const alertTypeToRuleType: Record<string, string | null> = {
  all: 'all',
  high_dq: 'high_dq',
  low_approval: 'low_approval',
  low_sales: 'low_sales',
  underwriting_threshold: 'underwriting_threshold',
  zero_sales: 'zero_sales',
  below_threshold_duration: 'below_threshold_duration',
  milestone_achievement: 'milestone',
  sales_alert: 'sales_alert',
}
const zeroSalesCheckTime = ref('16:00')

const milestonePercentage = ref(100)
const milestoneOptions = [
  { label: '75% of target', value: 75 },
  { label: '100% of target', value: 100 },
  { label: '125% of target', value: 125 }
]

const lowSalesPercentageGap = ref(50)
const lowSalesZeroHours = ref(2)
const belowThresholdHours = ref(4)
const progressUpdateMinHours = ref(2)
const progressUpdateMaxHours = ref(6)

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

      // Initialize below-threshold duration hours from rule condition settings when available
      const belowRule = rulesData.find(r => r.rule_type === 'below_threshold_duration') as any
      const consecutive = belowRule?.condition_settings?.consecutive_hours
      if (typeof consecutive === 'number' && !Number.isNaN(consecutive) && consecutive > 0) {
        belowThresholdHours.value = consecutive
      }
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
        lastSaleTime: null,
        underwritingCount: 0
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
          const underwritingItems = items.filter(i =>
            i.call_result && i.call_result.toLowerCase().includes('underwriting')
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
          centerMetric.underwritingCount = underwritingItems.length
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

// Filter metrics based on alert type and child filters
const filteredMetrics = computed(() => {
  const all = metrics.value
  const now = new Date()

  const isHighDq = (m: CenterMetrics) =>
    m.totalTransfers > 0 && m.dqRate > m.center.max_dq_percentage

  const isLowApproval = (m: CenterMetrics) =>
    m.totalTransfers > 0 && m.approvalRate < m.center.min_approval_ratio

  const isLowSales = (m: CenterMetrics) => {
    // Low sales: sales < target by X% OR 0 sales in Y hours
    const percentageGap = lowSalesPercentageGap.value
    const zeroHours = lowSalesZeroHours.value

    // Calculate actual percentage: (sales / target) * 100
    const calculatedPercent = m.center.daily_sales_target > 0 
      ? (m.salesCount / m.center.daily_sales_target) * 100 
      : 0
    
    // Check if sales are below the gap percentage threshold
    const belowGap = calculatedPercent < percentageGap

    // Check if 0 sales in last Y hours
    let zeroSalesInWindow = false
    if (m.lastSaleTime) {
      // Has sales: check hours since last sale
      const hoursSinceLastSale = (now.getTime() - m.lastSaleTime.getTime()) / (1000 * 60 * 60)
      zeroSalesInWindow = hoursSinceLastSale >= zeroHours
    } else {
      // No sales at all: check if enough hours have passed from start of day
      const startOfDay = new Date(now)
      startOfDay.setHours(9, 0, 0, 0) // Assuming business day starts at 9 AM
      if (now > startOfDay) {
        const hoursSinceStartOfDay = (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60)
        zeroSalesInWindow = hoursSinceStartOfDay >= zeroHours
      } else {
        // Before start of day, don't show as zero sales
        zeroSalesInWindow = false
      }
    }

    return belowGap || zeroSalesInWindow
  }

  const isUnderwritingThreshold = (m: CenterMetrics) =>
    m.underwritingCount > m.center.underwriting_threshold

  const isZeroSales = (m: CenterMetrics) => {
    return m.salesCount === 0
  }

  const isBelowThresholdDuration = (m: CenterMetrics) => {
    const hoursThreshold = belowThresholdHours.value || 0

    const belowTarget = m.salesCount < m.center.daily_sales_target
    if (!belowTarget) return false

    if (hoursThreshold <= 0) return true

    let hoursBelow = 0
    if (m.lastSaleTime) {
      const timeDiff = now.getTime() - m.lastSaleTime.getTime()
      hoursBelow = Math.max(0, timeDiff / (1000 * 60 * 60))
    } else {
      const startOfDay = new Date(now)
      startOfDay.setHours(9, 0, 0, 0)
      startOfDay.setMinutes(0, 0)
      startOfDay.setSeconds(0, 0)
      startOfDay.setMilliseconds(0)
      
      if (now.getTime() >= startOfDay.getTime()) {
        const timeDiff = now.getTime() - startOfDay.getTime()
        hoursBelow = Math.max(0, timeDiff / (1000 * 60 * 60))
      } else {
        hoursBelow = 0
      }
    }

    return hoursBelow >= hoursThreshold
  }

  const isMilestoneAchievement = (m: CenterMetrics) => {
    // Milestone: centers that reached X% of target
    const milestonePercent = milestonePercentage.value

    // Calculate actual percentage: (sales / target) * 100
    const calculatedPercent = m.center.daily_sales_target > 0 
      ? (m.salesCount / m.center.daily_sales_target) * 100 
      : 0
    
    // Check if calculated percentage meets or exceeds the milestone threshold
    // Show centers that meet the milestone regardless of quality metrics
    return calculatedPercent >= milestonePercent
  }

  const isProgressUpdate = (m: CenterMetrics) => {
    // Progress Update: centers with sales > 0 and hours remaining within range
    // This is a positive/encouraging alert for centers making progress
    const minHours = progressUpdateMinHours.value
    const maxHours = progressUpdateMaxHours.value
    const currentHour = now.getHours()
    
    // Calculate hours remaining (assuming business day ends at 6 PM / 18:00)
    const hoursRemaining = Math.max(0, 18 - currentHour)
    
    // Must have at least some sales (progress made)
    const hasSales = m.salesCount > 0
    
    // Hours remaining must be within the specified range
    const hoursInRange = hoursRemaining >= minHours && hoursRemaining <= maxHours
    
    // Optional: Only show if not already at 100%+ of target (to keep it encouraging, not congratulatory)
    const calculatedPercent = m.center.daily_sales_target > 0 
      ? (m.salesCount / m.center.daily_sales_target) * 100 
      : 0
    const notComplete = calculatedPercent < 100
    
    return hasSales && hoursInRange && notComplete
  }

  const isSalesAlert = (m: CenterMetrics) => {
    // Sales Alert: centers with sales > 0, hours remaining > 0, and not at 100% target
    // This is an encouraging alert: "X hrs left & Y sales in — awesome start, let's finish strong!"
    const currentHour = now.getHours()
    
    // Calculate hours remaining (assuming business day ends at 6 PM / 18:00)
    const hoursRemaining = Math.max(0, 18 - currentHour)
    
    // Must have at least some sales (progress made)
    const hasSales = m.salesCount > 0
    
    // Must have hours remaining in the day
    const hasTimeRemaining = hoursRemaining > 0
    
    // Only show if not already at 100%+ of target (to keep it encouraging, not congratulatory)
    const calculatedPercent = m.center.daily_sales_target > 0 
      ? (m.salesCount / m.center.daily_sales_target) * 100 
      : 0
    const notComplete = calculatedPercent < 100
    
    return hasSales && hasTimeRemaining && notComplete
  }

  switch (alertType.value) {
    case 'all':
      // Show only centers that meet at least one alert condition
      return all.filter(m =>
        isHighDq(m)
        || isLowApproval(m)
        || isLowSales(m)
        || isUnderwritingThreshold(m)
        || isZeroSales(m)
        || isBelowThresholdDuration(m)
        || isMilestoneAchievement(m)
        || isSalesAlert(m)
      )
    case 'high_dq':
      return all.filter(isHighDq)
    case 'low_approval':
      return all.filter(isLowApproval)
    case 'low_sales':
      return all.filter(isLowSales)
    //konsy carrier ka threshhold reach ho gya hy
    case 'underwriting_threshold':
      return all.filter(isUnderwritingThreshold)
    case 'zero_sales':
      return all.filter(isZeroSales)
    case 'below_threshold_duration':
      return all.filter(isBelowThresholdDuration)
    case 'milestone_achievement': {
      const milestonePercent = milestonePercentage.value

      // Debug logging for milestone filter
      const debugData = all.map(m => {
        const target = m.center.daily_sales_target
        const currentSales = m.salesCount
        // Calculate actual percentage: (sales / target) * 100
        const calculatedPercent = target > 0 ? (currentSales / target) * 100 : 0
        const meetsQuality = m.totalTransfers === 0 || (
          m.dqRate <= m.center.max_dq_percentage &&
          m.approvalRate >= m.center.min_approval_ratio
        )

        return {
          center: m.center.center_name,
          sales: currentSales,
          target,
          calculatedPercent: Number(calculatedPercent.toFixed(2)),
          filterMilestonePercent: milestonePercent,
          dqRate: Number(m.dqRate.toFixed(1)),
          approvalRate: Number(m.approvalRate.toFixed(1)),
          maxDq: m.center.max_dq_percentage,
          minApproval: m.center.min_approval_ratio,
          meetsMilestone: calculatedPercent >= milestonePercent,
          meetsQuality
        }
      })

      console.log('[alerts] milestone_achievement debug', debugData)

      return all.filter(isMilestoneAchievement)
    }
    case 'sales_alert':
      // Show all centers - filtering is only for alert sending, not for display
      return all
    default:
      return all
  }
})

// rules is used directly for the alert dropdown (no custom UI filtering)

const triggerAlert = async (centerId: string) => {
  // Pick the rule that matches the currently selected alert type
  const ruleType = alertTypeToRuleType[alertType.value] ?? null
  const rule = ruleType
    ? rules.value.find(r => r.rule_type === ruleType)
    : rules.value[0]
  if (!rule) {
    toast.add({ title: 'Error', description: 'No alert rules configured', color: 'red' })
    return
  }

  // Get the center metrics for the current center
  const centerMetric = metrics.value.find(m => m.center.id === centerId)
  
  // Prepare filter values to send to backend
  const filterValues: any = {}
  if (alertType.value === 'low_sales') {
    filterValues.percentage_gap = lowSalesPercentageGap.value
    filterValues.zero_sales_hours = lowSalesZeroHours.value
    if (centerMetric) {
      filterValues.current_sales = centerMetric.salesCount
      filterValues.target_sales = centerMetric.center.daily_sales_target
      filterValues.last_sale_time = centerMetric.lastSaleTime?.toISOString() || null
    }
  } else if (alertType.value === 'milestone_achievement') {
    filterValues.milestone_percentage = milestonePercentage.value
    if (centerMetric) {
      filterValues.current_sales = centerMetric.salesCount
      filterValues.target_sales = centerMetric.center.daily_sales_target
    }
  } else if (alertType.value === 'sales_alert') {
    if (centerMetric) {
      const now = new Date()
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      })
      
      const usTimeParts = formatter.formatToParts(now)
      const currentHour = parseInt(usTimeParts.find(p => p.type === 'hour')?.value || '0')
      const currentMinute = parseInt(usTimeParts.find(p => p.type === 'minute')?.value || '0')
      
      let hoursRemaining = 0
      
      if (currentHour >= 9 && currentHour < 19) {
        hoursRemaining = 19 - currentHour - (currentMinute / 60)
      } else if (currentHour < 9) {
        hoursRemaining = 19 - currentHour - (currentMinute / 60)
      } else {
        const minutesUntilMidnight = (60 - currentMinute) / 60
        const hoursUntilMidnight = 24 - currentHour - 1
        hoursRemaining = minutesUntilMidnight + hoursUntilMidnight + 19
      }
      
      hoursRemaining = Math.floor(Math.max(0, hoursRemaining))
      
      filterValues.current_sales = centerMetric.salesCount
      filterValues.hours_remaining = hoursRemaining
      
      if (rule && rule.condition_settings) {
        filterValues.condition_settings = rule.condition_settings
      }
    }
  }

  triggering.value = centerId
  try {
    const session = (await supabase.auth.getSession()).data.session

    const res: any = await $fetch('https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/check-alerts', {
      method: 'POST',
      body: {
        center_id: centerId,
        rule_id: rule.id,
        force: true,
        filter_values: filterValues
      },
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    })

    const outcome = Array.isArray(res?.results) ? res.results[0] : null
    console.log('[alerts] triggerAlert outcome', outcome)

    if (!outcome) {
      toast.add({
        title: 'No notification sent',
        description: 'Alert service did not return any result for this trigger.',
        color: 'yellow'
      })
      return
    }

    if (outcome.status === 'sent' || !outcome.status) {
      toast.add({
        title: 'Notification sent',
        description: outcome.message || `Slack alert sent for ${outcome.center} (${outcome.rule}).`,
        color: 'green'
      })
    } else if (outcome.status === 'skipped') {
      toast.add({
        title: 'No notification sent',
        description: outcome.message || 'Rule conditions were not met for this center.',
        color: 'yellow'
      })
    } else {
      toast.add({
        title: 'Error sending notification',
        description: outcome.message || 'An error occurred while sending the alert.',
        color: 'red'
      })
    }
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
    const ruleType = alertTypeToRuleType[alertType.value] ?? null
    const rule = ruleType
      ? rules.value.find(r => r.rule_type === ruleType)
      : rules.value[0]
    if (!rule) {
      toast.add({ title: 'Error', description: 'No alert rules configured', color: 'red' })
      return
    }

    // Prepare filter values to send to backend
    const filterValues: any = {}
    if (alertType.value === 'low_sales') {
      filterValues.percentage_gap = lowSalesPercentageGap.value
      filterValues.zero_sales_hours = lowSalesZeroHours.value
    } else if (alertType.value === 'milestone_achievement') {
      filterValues.milestone_percentage = milestonePercentage.value
    } else if (alertType.value === 'sales_alert') {
      const now = new Date()
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      })
      
      const usTimeParts = formatter.formatToParts(now)
      const currentHour = parseInt(usTimeParts.find(p => p.type === 'hour')?.value || '0')
      const currentMinute = parseInt(usTimeParts.find(p => p.type === 'minute')?.value || '0')
      
      let hoursRemaining = 0
      
      if (currentHour >= 9 && currentHour < 19) {
        hoursRemaining = 19 - currentHour - (currentMinute / 60)
      } else if (currentHour < 9) {
        hoursRemaining = 19 - currentHour - (currentMinute / 60)
      } else {
        const minutesUntilMidnight = (60 - currentMinute) / 60
        const hoursUntilMidnight = 24 - currentHour - 1
        hoursRemaining = minutesUntilMidnight + hoursUntilMidnight + 19
      }
      
      hoursRemaining = Math.floor(Math.max(0, hoursRemaining))
      
      filterValues.hours_remaining = hoursRemaining
      
      if (rule && rule.condition_settings) {
        filterValues.condition_settings = rule.condition_settings
      }
    }

    const res: any = await $fetch('https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/bulk-alerts', {
      method: 'POST',
      body: {
        center_ids: centerIds,
        rule_id: rule.id,
        force: true,
        filter_values: filterValues
      },
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    })

    console.log('[alerts] triggerBulkAlerts outcome', res)

    const totalSelected = centerIds.length
    const summary = res?.summary || {}
    const successful = typeof summary.successful === 'number'
      ? summary.successful
      : Array.isArray(res?.results) ? res.results.length : 0
    const failed = typeof summary.failed === 'number'
      ? summary.failed
      : Array.isArray(res?.errors) ? res.errors.length : 0
    const skipped = Math.max(totalSelected - successful - failed, 0)

    if (!res || (!successful && !failed && !skipped)) {
      toast.add({
        title: 'No notifications processed',
        description: 'Alert service did not return any results for this bulk trigger.',
        color: 'yellow'
      })
    } else if (successful > 0 && failed === 0 && skipped === 0) {
      toast.add({
        title: 'Notifications sent',
        description: `Slack alerts sent for ${successful} center${successful === 1 ? '' : 's'}.`,
        color: 'green'
      })
    } else if (successful > 0) {
      const parts: string[] = []
      parts.push(`${successful} sent`)
      if (skipped > 0) parts.push(`${skipped} skipped (conditions not met)`)
      if (failed > 0) parts.push(`${failed} failed`)

      toast.add({
        title: 'Bulk alerts partially sent',
        description: parts.join(', '),
        color: 'yellow'
      })
    } else {
      const parts: string[] = []
      if (skipped > 0) parts.push(`${skipped} skipped (conditions not met)`)
      if (failed > 0) parts.push(`${failed} failed`)

      toast.add({
        title: 'No notifications sent',
        description: parts.length > 0 ? parts.join(', ') : 'No centers met alert conditions.',
        color: failed > 0 ? 'red' : 'yellow'
      })
    }

    // Clear selection after completion
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

          <!-- Alert Type dropdown -->
          <USelect
            v-model="alertType"
            :items="alertTypeOptions"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Alert Type"
            class="min-w-64"
          />

          <!-- Child filters based on alert type -->
          <!-- Zero Sales: Time picker -->
          <div v-if="alertType === 'zero_sales'" class="flex items-center gap-2">
            <label class="text-sm text-gray-600 dark:text-gray-400">Check Time:</label>
            <input
              v-model="zeroSalesCheckTime"
              type="time"
              class="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <!-- Low Sales: Percentage gap and hours -->
          <div v-if="alertType === 'low_sales'" class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600 dark:text-gray-400">Gap %:</label>
              <input
                v-model.number="lowSalesPercentageGap"
                type="number"
                min="0"
                max="100"
                class="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600 dark:text-gray-400">Zero Hours:</label>
              <input
                v-model.number="lowSalesZeroHours"
                type="number"
                min="0"
                max="24"
                class="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>

          <!-- Below Threshold Duration: consecutive hours below target -->
          <div v-if="alertType === 'below_threshold_duration'" class="flex items-center gap-2">
            <label class="text-sm text-gray-600 dark:text-gray-400">Consecutive hours below target:</label>
            <input
              v-model.number="belowThresholdHours"
              type="number"
              min="1"
              max="24"
              class="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <!-- Milestone: preset selector + custom percentage input -->
          <div v-if="alertType === 'milestone_achievement'" class="flex items-center gap-3">
            <label class="text-sm text-gray-600 dark:text-gray-400">Milestone:</label>
            <USelect
              v-model="milestonePercentage"
              :items="milestoneOptions"
              option-attribute="label"
              value-attribute="value"
              class="min-w-40"
            />
            <div class="flex items-center gap-1">
              <input
                v-model.number="milestonePercentage"
                type="number"
                min="0"
                max="200"
                class="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
              <span class="text-xs text-gray-500 dark:text-gray-400">% of target</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ selectedCenters.size }} selected
          </span>
          <UButton
            v-if="selectedCenters.size > 0"
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
            :disabled="selectedCenters.size === 0"
            color="primary"
            size="sm"
            @click="triggerBulkAlerts"
          >
            Send Bulk Alerts ({{ selectedCenters.size }})
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
