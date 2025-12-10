<script setup lang="ts">
import type { Period, Range } from '~/types'
import { subDays } from 'date-fns'
import { getPreviousPeriodRange, formatDateEST, calculatePercentageChange } from '~/utils'

const props = defineProps<{
  period: Period
  range: Range
}>()

interface CenterThreshold {
  id: string
  center_name: string
  lead_vendor: string
  tier: 'A' | 'B' | 'C'
  daily_transfer_target: number
  daily_sales_target: number
  max_dq_percentage: number
  min_approval_ratio: number
  transfer_weight: number
  approval_ratio_weight: number
  dq_weight: number
  is_active: boolean
}

interface BpoCenterMetric {
  centerName: string
  leadVendor: string
  tier: string
  totalTransfers: number
  pendingApproval: number
  dqCount: number
  approvalRatio: number
  dqRate: number
  trend: number
  performanceScore: number
  rank: number
  performanceCategory: 'green' | 'yellow' | 'red' | 'gray'
  targetProgress: number
  color: string
}

const { fetchAll } = useDailyDealFlow()
const supabase = useSupabaseClient()

const calculatePerformanceScore = (
  metrics: any,
  threshold: CenterThreshold
): number => {
  // Transfer achievement (0-100)
  const transferScore = Math.min(100, (metrics.totalTransfers / threshold.daily_transfer_target) * 100)

  // Approval ratio score (0-100)
  const approvalScore = Math.min(100, (metrics.approvalRatio / threshold.min_approval_ratio) * 100)

  // DQ score (inverted - lower is better) (0-100)
  const dqScore = metrics.dqRate <= threshold.max_dq_percentage
    ? 100
    : Math.max(0, 100 - ((metrics.dqRate - threshold.max_dq_percentage) * 5))

  // Weighted total
  const totalScore = (
    (transferScore * threshold.transfer_weight / 100) +
    (approvalScore * threshold.approval_ratio_weight / 100) +
    (dqScore * threshold.dq_weight / 100)
  )

  return Math.round(totalScore * 10) / 10
}

const getPerformanceCategory = (
  score: number,
  approvalRatio: number,
  dqRate: number,
  threshold: CenterThreshold,
  totalTransfers: number
): 'green' | 'yellow' | 'red' | 'gray' => {
  // Gray: Zero transfers
  if (totalTransfers === 0) {
    return 'gray'
  }

  // Green: High score (≥80) AND meets approval & DQ thresholds
  if (
    score >= 80 &&
    approvalRatio >= threshold.min_approval_ratio &&
    dqRate <= threshold.max_dq_percentage
  ) {
    return 'green'
  }

  // Red: Low score (<60) OR fails both approval & DQ thresholds
  if (
    score < 60 ||
    (approvalRatio < threshold.min_approval_ratio && dqRate > threshold.max_dq_percentage)
  ) {
    return 'red'
  }

  // Yellow: Everything else
  return 'yellow'
}

const { data: centers } = await useAsyncData<BpoCenterMetric[]>(
  () => `bpo-centers-${formatDateEST(props.range.start)}-${formatDateEST(props.range.end)}`,
  async () => {
    try {
      const dateFrom = formatDateEST(props.range.start)
      const dateTo = formatDateEST(props.range.end)

      // Fetch thresholds
      const { data: thresholds, error: thresholdError } = await supabase
        .from('center_thresholds')
        .select('*')
        .eq('is_active', true)

      if (thresholdError || !thresholds) {
        console.error('Error fetching thresholds:', thresholdError)
        return []
      }

      // Create threshold map
      const thresholdMap = new Map<string, CenterThreshold>()
      thresholds.forEach(t => thresholdMap.set(t.lead_vendor, t))

      // Fetch current period data
      const { data: currentData, error } = await fetchAll({
        dateFrom,
        dateTo,
        limit: 10000,
        offset: 0
      })

      if (error || !currentData) {
        console.error('Error fetching BPO center data:', error)
        return []
      }

      const previousRange = getPreviousPeriodRange(props.range, subDays)
      const previousDateFrom = formatDateEST(previousRange.start)
      const previousDateTo = formatDateEST(previousRange.end)

      const { data: previousData } = await fetchAll({
        dateFrom: previousDateFrom,
        dateTo: previousDateTo,
        limit: 10000,
        offset: 0
      })

      const vendorMap = new Map<string, any>()

      currentData.forEach(record => {
        const vendor = record.lead_vendor || 'Unknown'

        if (!vendorMap.has(vendor)) {
          vendorMap.set(vendor, {
            centerName: vendor,
            leadVendor: vendor,
            totalTransfers: 0,
            pendingApproval: 0,
            dqCount: 0,
          })
        }

        const metrics = vendorMap.get(vendor)!
        metrics.totalTransfers++

        if (record.status === 'Pending Approval') {
          metrics.pendingApproval++
        }

        if (
          record.status === 'Returned To Center - DQ' ||
          record.status === "DQ'd Can't be sold" ||
          record.status === 'GI - Currently DQ'
        ) {
          metrics.dqCount++
        }
      })

      const previousVendorMap = new Map<string, any>()
      if (previousData) {
        previousData.forEach(record => {
          const vendor = record.lead_vendor || 'Unknown'

          if (!previousVendorMap.has(vendor)) {
            previousVendorMap.set(vendor, {
              totalTransfers: 0,
              pendingApproval: 0,
              dqCount: 0,
            })
          }

          const metrics = previousVendorMap.get(vendor)!
          metrics.totalTransfers++

          if (record.status === 'Pending Approval') {
            metrics.pendingApproval++
          }

          if (
            record.status === 'Returned To Center - DQ' ||
            record.status === "DQ'd Can't be sold" ||
            record.status === 'GI - Currently DQ'
          ) {
            metrics.dqCount++
          }
        })
      }

      // Calculate metrics and scores
      const result: BpoCenterMetric[] = []

      // Iterate over all active thresholds to ensure even centers with 0 transfers are shown
      thresholdMap.forEach((threshold, vendor) => {
        let metrics = vendorMap.get(vendor)

        // If no metrics found (0 transfers), create default zero-metrics object
        if (!metrics) {
          metrics = {
            centerName: vendor,
            leadVendor: vendor,
            totalTransfers: 0,
            pendingApproval: 0,
            dqCount: 0
          }
        }

        // Calculate ratios
        metrics.approvalRatio = metrics.totalTransfers > 0
          ? Math.round((metrics.pendingApproval / metrics.totalTransfers) * 1000) / 10
          : 0

        metrics.dqRate = metrics.totalTransfers > 0
          ? Math.round((metrics.dqCount / metrics.totalTransfers) * 1000) / 10
          : 0

        const previousMetrics = previousVendorMap.get(vendor) || {
          totalTransfers: 0,
          pendingApproval: 0,
          dqCount: 0
        }

        metrics.trend = calculatePercentageChange(
          metrics.totalTransfers,
          previousMetrics.totalTransfers
        )

        // Calculate performance score
        metrics.performanceScore = calculatePerformanceScore(metrics, threshold)

        // Determine performance category
        metrics.performanceCategory = getPerformanceCategory(
          metrics.performanceScore,
          metrics.approvalRatio,
          metrics.dqRate,
          threshold,
          metrics.totalTransfers
        )

        // Target progress
        metrics.targetProgress = Math.round((metrics.totalTransfers / threshold.daily_transfer_target) * 100)

        metrics.tier = threshold.tier
        const colorMap: Record<string, string> = {
          'green': 'success',
          'yellow': 'warning',
          'red': 'error',
          'gray': 'neutral'
        }
        metrics.color = colorMap[metrics.performanceCategory] || 'neutral'

        result.push(metrics as BpoCenterMetric)
      })

      // Sort by performance score (highest first)
      result.sort((a, b) => b.performanceScore - a.performanceScore)

      // Assign ranks
      result.forEach((center, index) => {
        center.rank = index + 1
      })

      // Group by performance category (green, yellow, red, gray)
      const greenCenters = result.filter(c => c.performanceCategory === 'green')
      const yellowCenters = result.filter(c => c.performanceCategory === 'yellow')
      const redCenters = result.filter(c => c.performanceCategory === 'red')
      const grayCenters = result.filter(c => c.performanceCategory === 'gray')

      return [...greenCenters, ...yellowCenters, ...redCenters, ...grayCenters]
    } catch (err) {
      console.error('BPO centers error:', err)
      return []
    }
  },
  {
    watch: [() => props.period, () => props.range],
    default: () => []
  }
)

const greenCenters = computed(() => centers.value?.filter(c => c.performanceCategory === 'green') || [])
const yellowCenters = computed(() => centers.value?.filter(c => c.performanceCategory === 'yellow') || [])
const redCenters = computed(() => centers.value?.filter(c => c.performanceCategory === 'red') || [])
const grayCenters = computed(() => centers.value?.filter(c => c.performanceCategory === 'gray') || [])

const sectionOpen = ref({
  green: true,
  yellow: true,
  red: true,
  gray: true
})
</script>

<template>
  <div class="space-y-8">
    <!-- Green Centers (Top Performers) -->
    <div v-if="greenCenters.length > 0">
      <div class="flex items-center gap-2 mb-4 cursor-pointer select-none hover:opacity-80 transition-opacity"
        @click="sectionOpen.green = !sectionOpen.green">
        <div class="p-2 rounded-full bg-success/10">
          <UIcon name="i-lucide-trophy" class="text-success size-5" />
        </div>
        <h3 class="text-lg font-semibold text-success">Top Performers</h3>
        <UBadge color="success" variant="subtle">{{ greenCenters.length }} Centers</UBadge>
        <UIcon :name="sectionOpen.green ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="ml-auto size-5 text-muted" />
      </div>

      <div v-show="sectionOpen.green" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <BpoCenterCard
          v-for="(center, index) in greenCenters"
          :key="index"
          :center="center"
          variant="green"
        />
      </div>
    </div>

    <!-- Yellow Centers (Average Performers) -->
    <div v-if="yellowCenters.length > 0">
      <div class="flex items-center gap-2 mb-4 cursor-pointer select-none hover:opacity-80 transition-opacity"
        @click="sectionOpen.yellow = !sectionOpen.yellow">
        <div class="p-2 rounded-full bg-warning/10">
          <UIcon name="i-lucide-medal" class="text-warning size-5" />
        </div>
        <h3 class="text-lg font-semibold text-warning">Average Performers</h3>
        <UBadge color="warning" variant="subtle">{{ yellowCenters.length }} Centers</UBadge>
        <UIcon :name="sectionOpen.yellow ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="ml-auto size-5 text-muted" />
      </div>

      <div v-show="sectionOpen.yellow" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <BpoCenterCard
          v-for="(center, index) in yellowCenters"
          :key="index"
          :center="center"
          variant="yellow"
        />
      </div>
    </div>

    <!-- Red Centers (Needs Improvement) -->
    <div v-if="redCenters.length > 0">
      <div class="flex items-center gap-2 mb-4 cursor-pointer select-none hover:opacity-80 transition-opacity"
        @click="sectionOpen.red = !sectionOpen.red">
        <div class="p-2 rounded-full bg-error/10">
          <UIcon name="i-lucide-alert-triangle" class="text-error size-5" />
        </div>
        <h3 class="text-lg font-semibold text-error">Needs Improvement</h3>
        <UBadge color="error" variant="subtle">{{ redCenters.length }} Centers</UBadge>
        <UIcon :name="sectionOpen.red ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="ml-auto size-5 text-muted" />
      </div>

      <div v-show="sectionOpen.red" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <BpoCenterCard
          v-for="(center, index) in redCenters"
          :key="index"
          :center="center"
          variant="red"
        />
      </div>
    </div>

    <!-- Gray Centers (Zero Transfer) -->
    <div v-if="grayCenters.length > 0">
      <div class="flex items-center gap-2 mb-4 cursor-pointer select-none hover:opacity-80 transition-opacity"
        @click="sectionOpen.gray = !sectionOpen.gray">
        <div class="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
          <UIcon name="i-lucide-minus-circle" class="text-gray-500 size-5" />
        </div>
        <h3 class="text-lg font-semibold text-gray-500">Zero Transfer for the Day</h3>
        <UBadge color="neutral" variant="subtle">{{ grayCenters.length }} Centers</UBadge>
        <UIcon :name="sectionOpen.gray ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="ml-auto size-5 text-muted" />
      </div>

      <div v-show="sectionOpen.gray" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <BpoCenterCard
          v-for="(center, index) in grayCenters"
          :key="index"
          :center="center"
          variant="gray"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!greenCenters.length && !yellowCenters.length && !redCenters.length && !grayCenters.length" class="text-center py-12">
      <UIcon name="i-lucide-building-2" class="size-12 text-muted mx-auto mb-4" />
      <p class="text-muted">No BPO center data available for the selected date range</p>
    </div>
  </div>
</template>
