<script setup lang="ts">
import type { Period, Range } from '~/types'
import { calculateMetricsWithComparison, buildStatsFromMetrics, calculatePercentageChange, formatDateEST } from '~/utils'
import { getPreviousBusinessDatesForComparison, getWorkingDatesBetween } from '~/utils/workingDays'

const props = defineProps<{
  period: Period
  range: Range
  retentionOnly?: boolean
  leadVendors?: string[]
}>()

const { fetchAllByWorkingDates } = useDailyDealFlow()

const { data: stats } = await useAsyncData(
  () => `analytics-stats-${formatDateEST(props.range.start)}-${formatDateEST(props.range.end)}-${Boolean(props.retentionOnly)}-${props.leadVendors?.join(',') || 'all'}`,
  async () => {
    const currentBusinessDates = getWorkingDatesBetween(props.range.start, props.range.end, {
      excludeSaturday: true
    })
    const previousBusinessDates = getPreviousBusinessDatesForComparison(currentBusinessDates, {
      excludeSaturday: true
    })

    const fetchOptions = {
      dates: currentBusinessDates,
      limit: 10000,
      offset: 0,
      ...(props.leadVendors?.length ? { leadVendors: props.leadVendors } : {})
    }

    const { data: currentData, error: currentError } = await fetchAllByWorkingDates(fetchOptions)

    if (currentError) {
      return []
    }

    const { data: previousData, error: previousError } = await fetchAllByWorkingDates({
      dates: previousBusinessDates,
      limit: 10000,
      offset: 0,
      ...(props.leadVendors?.length ? { leadVendors: props.leadVendors } : {})
    })

    const isRetentionOnly = Boolean(props.retentionOnly)
    const retentionFilter = (d: any) => {
      const v = d?.retention_agent
      return v !== null && v !== undefined && String(v).trim() !== ''
    }

    const nonRetentionFilter = (d: any) => !retentionFilter(d)
    const activeFilter = isRetentionOnly ? retentionFilter : nonRetentionFilter

    const filteredCurrentData = currentData?.filter(activeFilter) || []
    const filteredPreviousData = (previousError ? null : previousData)?.filter(activeFilter) || []

    const { metrics, changes } = calculateMetricsWithComparison(
      filteredCurrentData,
      filteredCurrentData.length,
      filteredPreviousData,
      previousError ? 0 : (filteredPreviousData?.length || 0)
    )

    if (!isRetentionOnly) {
      return buildStatsFromMetrics(metrics, changes)
    }

    const fixesStatuses = new Set([
      'Pending Failed Payment Fix',
      'Fulfilled carrier requirements'
    ])

    const currentFixes = filteredCurrentData.filter(d => fixesStatuses.has(String(d?.status || ''))).length
    const previousFixes = (filteredPreviousData || []).filter(d => fixesStatuses.has(String(d?.status || ''))).length
    const fixesChange = calculatePercentageChange(currentFixes, previousFixes)

    const retentionMetrics = {
      ...metrics,
      giCurrentlyDq: currentFixes
    }

    const retentionChanges = {
      ...changes,
      giCurrentlyDq: fixesChange
    }

    return buildStatsFromMetrics(retentionMetrics, retentionChanges).map((stat) => {
      if (stat.title === 'GI - Currently DQ') {
        return {
          ...stat,
          title: 'Fixes'
        }
      }
      return stat
    })
  },
  {
    watch: [() => props.period, () => props.range, () => props.retentionOnly, () => props.leadVendors],
    default: () => []
  }
)
</script>

<template>
  <UPageGrid class="lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard
      v-for="(stat, index) in stats"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: `p-2.5 rounded-full bg-${stat.color}/10 ring ring-inset ring-${stat.color}/25 flex-col`,
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex items-center gap-2">
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value.toLocaleString() }}
        </span>

        <UBadge
          :color="stat.variation === 0 ? 'neutral' : stat.variation > 0 ? 'success' : 'error'"
          variant="subtle"
          class="text-xs"
        >
          {{ stat.variation === 0 ? '-' : stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
