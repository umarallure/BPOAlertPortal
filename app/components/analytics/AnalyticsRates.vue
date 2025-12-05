<script setup lang="ts">
import type { Period, Range } from '~/types'
import { DateFormatter } from '@internationalized/date'

const props = defineProps<{
  period: Period
  range: Range
}>()

interface RateMetric {
  title: string
  icon: string
  percentage: number
  total: number
  count: number
  color: string
}

const { fetchAll } = useDailyDealFlow()

const dateFormatter = new DateFormatter('en-CA', {
  dateStyle: 'short',
  timeZone: 'America/New_York'
})

const formatDateEST = (date: Date): string => {
  return dateFormatter.format(date)
}

const { data: rates } = await useAsyncData<RateMetric[]>(
  () => `analytics-rates-${formatDateEST(props.range.start)}-${formatDateEST(props.range.end)}`,
  async () => {
  try {
    const dateFrom = formatDateEST(props.range.start)
    const dateTo = formatDateEST(props.range.end)
    
    // Fetch all data for the date range
    const { data, count, error } = await fetchAll({
      dateFrom,
      dateTo,
      limit: 10000,
      offset: 0
    })
    
    if (error || !data) {
      console.error('Error fetching analytics rates data:', error)
      return [
        {
          title: 'Approval Rate',
          icon: 'i-lucide-check-circle-2',
          percentage: 0,
          total: 0,
          count: 0,
          color: 'success'
        },
        {
          title: 'Callback Rate',
          icon: 'i-lucide-phone',
          percentage: 0,
          total: 0,
          count: 0,
          color: 'info'
        },
        {
          title: 'DQ Rate',
          icon: 'i-lucide-x-circle',
          percentage: 0,
          total: 0,
          count: 0,
          color: 'error'
        },
        {
          title: 'Underwriting',
          icon: 'i-lucide-file-check',
          percentage: 0,
          total: 0,
          count: 0,
          color: 'warning'
        }
      ]
    }
    
    // Calculate metrics based on fetched data
    const totalTransfers = count || 0
    
    // Approval Rate = entries with status "Pending Approval" / Total Transfers * 100
    const approvalCount = data.filter(d => d.status === 'Pending Approval').length
    const approvalRate = totalTransfers > 0 ? (approvalCount / totalTransfers) * 100 : 0
    
    // Callback Rate = (Total Transfers - Pending Approval) / entries with status "Needs BPO Callback" + "Incomplete Transfer" * 100
    const needsCallbackCount = data.filter(d => d.status === 'Needs BPO Callback' || d.status === 'Incomplete Transfer').length
    const nonPendingCount = totalTransfers - approvalCount
    const callbackRate = nonPendingCount > 0 ? (needsCallbackCount / nonPendingCount) * 100 : 0
    
    // DQ Rate = (Total Transfers - Pending Approval) / entries with status "Returned To Center - DQ" + "DQ'd Can't be sold" + "GI - Currently DQ" * 100
    const dqCount = data.filter(d => 
      d.status === "Returned To Center - DQ" || 
      d.status === "DQ'd Can't be sold" || 
      d.status === "GI - Currently DQ"
    ).length
    const dqRate = nonPendingCount > 0 ? (dqCount / nonPendingCount) * 100 : 0
    
    // Underwriting Rate = Count of entries with call_result "Underwriting" / "Pending Approval" * 100
    const underwritingCount = data.filter(d => d.call_result === 'Underwriting').length
    const underwritingRate = approvalCount > 0 ? (underwritingCount / approvalCount) * 100 : 0
    
    return [
      {
        title: 'Approval Rate',
        icon: 'i-lucide-check-circle-2',
        percentage: Math.round(approvalRate * 10) / 10,
        total: totalTransfers,
        count: approvalCount,
        color: 'success'
      },
      {
        title: 'Callback Rate',
        icon: 'i-lucide-phone',
        percentage: Math.round(callbackRate * 10) / 10,
        total: nonPendingCount,
        count: needsCallbackCount,
        color: 'info'
      },
      {
        title: 'DQ Rate',
        icon: 'i-lucide-x-circle',
        percentage: Math.round(dqRate * 10) / 10,
        total: nonPendingCount,
        count: dqCount,
        color: 'error'
      },
      {
        title: 'Underwriting',
        icon: 'i-lucide-file-check',
        percentage: Math.round(underwritingRate * 10) / 10,
        total: approvalCount, // show as "of Pending Approval" per requirement
        count: underwritingCount,
        color: 'warning'
      }
    ]
  } catch (err) {
    console.error('Analytics rates error:', err)
    return [
      {
        title: 'Approval Rate',
        icon: 'i-lucide-check-circle-2',
        percentage: 0,
        total: 0,
        count: 0,
        color: 'success'
      },
      {
        title: 'Callback Rate',
        icon: 'i-lucide-phone',
        percentage: 0,
        total: 0,
        count: 0,
        color: 'info'
      },
      {
        title: 'DQ Rate',
        icon: 'i-lucide-x-circle',
        percentage: 0,
        total: 0,
        count: 0,
        color: 'error'
      },
      {
        title: 'Underwriting',
        icon: 'i-lucide-file-check',
        percentage: 0,
        total: 0,
        count: 0,
        color: 'warning'
      }
    ]
  }
}, {
  watch: [() => props.period, () => props.range],
  default: () => []
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <div
      v-for="(rate, index) in rates"
      :key="index"
      class="bg-card rounded-lg border border-default p-4 hover:shadow-md transition-shadow"
    >
      <div class="flex items-start justify-between mb-4">
        <div>
          <p class="text-sm font-medium text-muted uppercase">{{ rate.title }}</p>
          <p class="text-3xl font-bold text-highlighted mt-1">{{ rate.percentage }}%</p>
        </div>
        <div :class="`p-2.5 rounded-full bg-${rate.color}/10 ring ring-inset ring-${rate.color}/25`">
          <UIcon :name="rate.icon" :class="`text-${rate.color} size-5`" />
        </div>
      </div>

      <div class="space-y-1.5 text-xs text-muted">
        <div class="flex justify-between">
          <span>{{ rate.count }} of {{ rate.total }}</span>
          <span>{{ rate.total ? ((rate.count / rate.total) * 100).toFixed(1) : '0.0' }}%</span>
        </div>
        <UProgress :value="rate.total ? (rate.count / rate.total) * 100 : 0" :ui="{ progress: `bg-${rate.color}` }" />
      </div>
    </div>
  </div>
</template>
