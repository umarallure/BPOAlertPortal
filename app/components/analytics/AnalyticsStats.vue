<script setup lang="ts">
import type { Period, Range } from '~/types'
import { DateFormatter } from '@internationalized/date'

const props = defineProps<{
  period: Period
  range: Range
}>()

const { fetchAll } = useDailyDealFlow()

const dateFormatter = new DateFormatter('en-CA', {
  dateStyle: 'short',
  timeZone: 'America/New_York'
})

const formatDateEST = (date: Date): string => {
  return dateFormatter.format(date)
}

const baseStats = [{
  title: 'Total Transfers',
  icon: 'i-lucide-send',
  status: null,
  color: 'primary'
}, {
  title: 'Pending Approval',
  icon: 'i-lucide-clock',
  status: 'Pending Approval',
  color: 'warning'
}, {
  title: 'Underwriting',
  icon: 'i-lucide-file-text',
  status: 'Underwriting',
  color: 'info'
}, {
  title: 'Approved',
  icon: 'i-lucide-check-circle',
  status: 'Approved',
  color: 'success'
}]

const { data: stats } = await useAsyncData<any[]>(
  () => `analytics-stats-${formatDateEST(props.range.start)}-${formatDateEST(props.range.end)}`,
  async () => {
  try {
    const dateFrom = formatDateEST(props.range.start)
    const dateTo = formatDateEST(props.range.end)
    
    // Fetch all data for the date range with a large limit
    const { data, count, error } = await fetchAll({
      dateFrom,
      dateTo,
      limit: 10000,
      offset: 0
    })
    
    if (error) {
      console.error('Error fetching analytics data:', error)
      return baseStats.map((stat) => ({
        title: stat.title,
        icon: stat.icon,
        value: 0,
        variation: 0,
        color: stat.color
      }))
    }
    
    // Calculate stats based on fetched data
    const totalCount = count || 0
    const pendingCount = data?.filter(d => d.status === 'Pending Approval').length || 0
    const underwritingCount = data?.filter(d => d.call_result === 'Underwriting').length || 0
    const approvedCount = pendingCount - underwritingCount
    
    return [
      {
        title: 'Total Transfers',
        icon: 'i-lucide-send',
        value: totalCount,
        variation: 0,
        color: 'primary'
      },
      {
        title: 'Pending Approval',
        icon: 'i-lucide-clock',
        value: pendingCount,
        variation: totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0,
        color: 'warning'
      },
      {
        title: 'Underwriting',
        icon: 'i-lucide-file-text',
        value: underwritingCount,
        variation: totalCount > 0 ? Math.round((underwritingCount / totalCount) * 100) : 0,
        color: 'info'
      },
      {
        title: 'Approved',
        icon: 'i-lucide-check-circle',
        value: approvedCount,
        variation: totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0,
        color: 'success'
      }
    ]
  } catch (err) {
    console.error('Analytics error:', err)
    return baseStats.map((stat) => ({
      title: stat.title,
      icon: stat.icon,
      value: 0,
      variation: 0,
      color: stat.color
    }))
  }
}, {
  watch: [() => props.period, () => props.range],
  default: () => []
})
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
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
          :color="stat.variation > 0 ? 'success' : 'error'"
          variant="subtle"
          class="text-xs"
        >
          {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
