<script setup lang="ts">
import type { Period, Range } from '~/types'
import { subDays } from 'date-fns'
import { fetchAnalyticsStats, formatDateEST } from '~/utils'

const props = defineProps<{
  period: Period
  range: Range
}>()

const { fetchAll } = useDailyDealFlow()

const { data: stats } = await useAsyncData(
  () => `analytics-stats-${formatDateEST(props.range.start)}-${formatDateEST(props.range.end)}`,
  () => fetchAnalyticsStats(props.range, fetchAll, subDays),
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
