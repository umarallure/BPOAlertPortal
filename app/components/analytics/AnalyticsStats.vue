<script setup lang="ts">
import type { Period, Range } from '~/types'
import { calculateMetricsWithComparison, buildStatsFromMetrics, formatDateEST } from '~/utils'
import { getPreviousBusinessDatesForComparison, getWorkingDatesBetween } from '~/utils/workingDays'

const props = defineProps<{
  period: Period
  range: Range
}>()

const { fetchAllByWorkingDates } = useDailyDealFlow()

const { data: stats } = await useAsyncData(
  () => `analytics-stats-${formatDateEST(props.range.start)}-${formatDateEST(props.range.end)}`,
  async () => {
    const currentBusinessDates = getWorkingDatesBetween(props.range.start, props.range.end, {
      excludeSaturday: true
    })
    const previousBusinessDates = getPreviousBusinessDatesForComparison(currentBusinessDates, {
      excludeSaturday: true
    })

    const { data: currentData, error: currentError } = await fetchAllByWorkingDates({
      dates: currentBusinessDates,
      limit: 10000,
      offset: 0
    })

    if (currentError) {
      return []
    }

    const { data: previousData, error: previousError } = await fetchAllByWorkingDates({
      dates: previousBusinessDates,
      limit: 10000,
      offset: 0
    })

    const { metrics, changes } = calculateMetricsWithComparison(
      currentData,
      currentData.length,
      previousError ? null : previousData,
      previousError ? 0 : (previousData?.length || 0)
    )

    return buildStatsFromMetrics(metrics, changes)
  },
  {
    watch: [() => props.period, () => props.range],
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
