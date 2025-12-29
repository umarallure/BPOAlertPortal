<script setup lang="ts">
import type { Period, Range } from '~/types'
import { formatDateEST, calculatePercentageChange } from '~/utils'
import { getPreviousBusinessDatesForComparison, getWorkingDatesBetween } from '~/utils/workingDays'

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

const { fetchAllByWorkingDates } = useDailyDealFlow()
const supabase = useSupabaseClient()

const calculateRawScore = (
  metrics: any
): number => {
  const submitted = metrics.pendingApproval || 0
  const transfers = metrics.totalTransfers || 0
  const dq = metrics.dqCount || 0
  
  const rawScore = (submitted * 3) + (transfers * 1) - (dq * 2)
  return rawScore
}

const getPerformanceCategory = (
  score: number,
  approvalRatio: number,
  dqRate: number,
  threshold: CenterThreshold,
  totalTransfers: number
): 'green' | 'yellow' | 'red' | 'gray' => {
  if (totalTransfers === 0) {
    return 'gray'
  }

  if (score >= 80) {
    return 'green'
  }

  if (score < 60) {
    return 'red'
  }

  return 'yellow'
}

const { data: centers } = await useAsyncData<BpoCenterMetric[]>(
  () => `bpo-centers-${formatDateEST(props.range.start)}-${formatDateEST(props.range.end)}`,
  async () => {
    try {
      const shouldLog = import.meta.dev
      const toYmd = (d: Date) => formatDateEST(d)

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

      const currentWorkingDates = getWorkingDatesBetween(props.range.start, props.range.end, {
        excludeSaturday: true
      })
      const previousWorkingDates = getPreviousBusinessDatesForComparison(currentWorkingDates, {
        excludeSaturday: true
      })

      if (shouldLog) {
        console.log('[BPO Center Performance][1] Selected range (raw):', {
          start: props.range.start,
          end: props.range.end,
          startYmd: toYmd(props.range.start),
          endYmd: toYmd(props.range.end)
        })
        console.log('[BPO Center Performance][2] Current business dates (Mon-Fri):', {
          count: currentWorkingDates.length,
          first: currentWorkingDates[0] ? toYmd(currentWorkingDates[0]) : null,
          last: currentWorkingDates[currentWorkingDates.length - 1]
            ? toYmd(currentWorkingDates[currentWorkingDates.length - 1]!)
            : null,
          dates: currentWorkingDates.map(toYmd)
        })
        console.log('[BPO Center Performance][3] Previous working dates for comparison:', {
          count: previousWorkingDates.length,
          first: previousWorkingDates[0] ? toYmd(previousWorkingDates[0]) : null,
          last: previousWorkingDates[previousWorkingDates.length - 1]
            ? toYmd(previousWorkingDates[previousWorkingDates.length - 1]!)
            : null,
          dates: previousWorkingDates.map(toYmd)
        })
      }

      // Fetch current period data (working days only)
      const { data: currentData, error } = await fetchAllByWorkingDates({
        dates: currentWorkingDates,
        limit: 10000,
        offset: 0
      })

      if (error || !currentData) {
        console.error('Error fetching BPO center data:', error)
        return []
      }

      const { data: previousData } = await fetchAllByWorkingDates({
        dates: previousWorkingDates,
        limit: 10000,
        offset: 0
      })

      if (shouldLog) {
        console.log('[BPO Center Performance][4] Fetch results summary:', {
          current: {
            rowCount: currentData.length,
            firstRow: currentData[0] || null,
            lastRow: currentData[currentData.length - 1] || null
          },
          previous: {
            rowCount: previousData?.length || 0,
            firstRow: previousData?.[0] || null,
            lastRow: previousData?.[previousData.length - 1] || null
          }
        })
      }

      const vendorMap = new Map<string, any>()

      currentData.forEach((record) => {
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
        previousData.forEach((record) => {
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

      if (shouldLog) {
        console.log('[BPO Center Performance][5] Aggregated vendor maps:', {
          currentVendors: Array.from(vendorMap.keys()),
          previousVendors: Array.from(previousVendorMap.keys()),
          currentTotalsPreview: Array.from(vendorMap.entries()).slice(0, 10).map(([vendor, m]) => ({
            vendor,
            totalTransfers: m.totalTransfers,
            pendingApproval: m.pendingApproval,
            dqCount: m.dqCount
          })),
          previousTotalsPreview: Array.from(previousVendorMap.entries()).slice(0, 10).map(([vendor, m]) => ({
            vendor,
            totalTransfers: m.totalTransfers,
            pendingApproval: m.pendingApproval,
            dqCount: m.dqCount
          }))
        })
      }

      if (shouldLog) {
        const vendorsToInspect = Array.from(new Set([
          ...thresholdMap.keys(),
          ...vendorMap.keys(),
          ...previousVendorMap.keys()
        ]))

        const perCenterComparison = vendorsToInspect.map((vendor) => {
          const cur = vendorMap.get(vendor) || {
            totalTransfers: 0,
            pendingApproval: 0,
            dqCount: 0
          }
          const prev = previousVendorMap.get(vendor) || {
            totalTransfers: 0,
            pendingApproval: 0,
            dqCount: 0
          }

          const curApprovalRatio = cur.totalTransfers > 0
            ? Math.round((cur.pendingApproval / cur.totalTransfers) * 1000) / 10
            : 0
          const curDqRate = cur.totalTransfers > 0
            ? Math.round((cur.dqCount / cur.totalTransfers) * 1000) / 10
            : 0

          const prevApprovalRatio = prev.totalTransfers > 0
            ? Math.round((prev.pendingApproval / prev.totalTransfers) * 1000) / 10
            : 0
          const prevDqRate = prev.totalTransfers > 0
            ? Math.round((prev.dqCount / prev.totalTransfers) * 1000) / 10
            : 0

          return {
            leadVendor: vendor,
            current: {
              totalTransfers: cur.totalTransfers,
              pendingApproval: cur.pendingApproval,
              dqCount: cur.dqCount,
              approvalRatio: curApprovalRatio,
              dqRate: curDqRate
            },
            previous: {
              totalTransfers: prev.totalTransfers,
              pendingApproval: prev.pendingApproval,
              dqCount: prev.dqCount,
              approvalRatio: prevApprovalRatio,
              dqRate: prevDqRate
            },
            trendInputs: {
              currentTransfers: cur.totalTransfers,
              previousTransfers: prev.totalTransfers
            }
          }
        })

        console.log('[BPO Center Performance][5.1] Per-center raw totals (current vs previous):', {
          currentDates: currentWorkingDates.map(toYmd),
          previousDates: previousWorkingDates.map(toYmd),
          rows: perCenterComparison
        })
      }

      // Calculate metrics and scores
      const result: BpoCenterMetric[] = []
      const rawScores: number[] = []

      // First pass: calculate all raw scores
      thresholdMap.forEach((threshold, vendor) => {
        let metrics = vendorMap.get(vendor)

        if (!metrics) {
          metrics = {
            centerName: vendor,
            leadVendor: vendor,
            totalTransfers: 0,
            pendingApproval: 0,
            dqCount: 0
          }
        }

        const rawScore = calculateRawScore(metrics)
        rawScores.push(rawScore)
      })

      // Find min and max for normalization
      const minScore = rawScores.length > 0 ? Math.min(...rawScores) : 0
      const maxScore = rawScores.length > 0 ? Math.max(...rawScores) : 1
      const scoreRange = maxScore - minScore

      // Second pass: calculate normalized scores and build result
      thresholdMap.forEach((threshold, vendor) => {
        let metrics = vendorMap.get(vendor)

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

        // Calculate normalized performance score (1-100)
        const rawScore = calculateRawScore(metrics)
        let normalizedScore = 1
        if (scoreRange > 0) {
          normalizedScore = ((rawScore - minScore) / scoreRange) * 99 + 1
        } else if (rawScore > 0) {
          normalizedScore = 100
        }
        metrics.performanceScore = Math.round(normalizedScore * 10) / 10

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
          green: 'success',
          yellow: 'warning',
          red: 'error',
          gray: 'neutral'
        }
        metrics.color = colorMap[metrics.performanceCategory] || 'neutral'

        result.push(metrics as BpoCenterMetric)
      })

      if (shouldLog) {
        console.log('[BPO Center Performance][6] Final computed center metrics (after comparison):', {
          count: result.length,
          sample: result.slice(0, 15).map(r => ({
            leadVendor: r.leadVendor,
            tier: r.tier,
            totalTransfers: r.totalTransfers,
            pendingApproval: r.pendingApproval,
            approvalRatio: r.approvalRatio,
            dqCount: r.dqCount,
            dqRate: r.dqRate,
            trend: r.trend,
            performanceScore: r.performanceScore,
            performanceCategory: r.performanceCategory,
            targetProgress: r.targetProgress
          }))
        })
      }

      // Sort by performance score (highest first)
      result.sort((a, b) => b.performanceScore - a.performanceScore)

      // Assign ranks
      result.forEach((center, index) => {
        center.rank = index + 1
      })

      if (shouldLog) {
        console.log('[BPO Center Performance][7] Final sorted + ranked output:', {
          top: result.slice(0, 15).map(r => ({
            rank: r.rank,
            leadVendor: r.leadVendor,
            performanceScore: r.performanceScore,
            performanceCategory: r.performanceCategory,
            trend: r.trend
          }))
        })
      }

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
