<script setup lang="ts">
interface CenterCardData {
  centerName: string
  tier: string
  totalTransfers: number
  pendingApproval: number
  dqRate: number
  approvalRatio: number
  performanceScore: number
  targetProgress: number
  trend: number
}

const props = defineProps<{
  center: CenterCardData
  variant: 'green' | 'yellow' | 'red' | 'gray'
}>()

const variantConfig = computed(() => {
  switch (props.variant) {
    case 'green':
      return {
        scoreBadgeColor: 'success',
        cardClass: 'bg-card rounded-lg border-2 border-success p-4 hover:shadow-lg transition-all relative overflow-hidden',
        metricBoxClass: 'bg-success/5 rounded-lg p-3 border border-success/20',
        progressColor: 'success',
        pendingTextClass: 'text-warning',
        dqTextClass: 'text-error',
        approvalTextClass: 'text-success',
        trendBorderClass: 'border-success/20'
      }
    case 'yellow':
      return {
        scoreBadgeColor: 'warning',
        cardClass: 'bg-card rounded-lg border-2 border-warning p-4 hover:shadow-lg transition-all relative overflow-hidden',
        metricBoxClass: 'bg-warning/5 rounded-lg p-3 border border-warning/20',
        progressColor: 'warning',
        pendingTextClass: 'text-warning',
        dqTextClass: 'text-error',
        approvalTextClass: 'text-success',
        trendBorderClass: 'border-warning/20'
      }
    case 'red':
      return {
        scoreBadgeColor: 'error',
        cardClass: 'bg-card rounded-lg border-2 border-error p-4 hover:shadow-lg transition-all relative overflow-hidden',
        metricBoxClass: 'bg-error/5 rounded-lg p-3 border border-error/20',
        progressColor: 'error',
        pendingTextClass: 'text-warning',
        dqTextClass: 'text-error',
        approvalTextClass: 'text-success',
        trendBorderClass: 'border-error/20'
      }
    case 'gray':
      return {
        scoreBadgeColor: 'neutral',
        cardClass: 'bg-card rounded-lg border-2 border-gray-200 dark:border-gray-800 p-4 hover:shadow-lg transition-all relative overflow-hidden opacity-75 hover:opacity-100',
        metricBoxClass: 'bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-800',
        progressColor: 'neutral',
        pendingTextClass: 'text-gray-500',
        dqTextClass: 'text-gray-500',
        approvalTextClass: 'text-gray-500',
        trendBorderClass: 'border-gray-100 dark:border-gray-800'
      }
  }

  return {
    scoreBadgeColor: 'neutral',
    cardClass: 'bg-card rounded-lg p-4 hover:shadow-lg transition-all relative overflow-hidden',
    metricBoxClass: 'bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-800',
    progressColor: 'neutral',
    pendingTextClass: 'text-muted',
    dqTextClass: 'text-muted',
    approvalTextClass: 'text-muted',
    trendBorderClass: 'border-gray-100 dark:border-gray-800'
  }
})
</script>

<template>
  <div :class="variantConfig.cardClass">
    <!-- Performance Badge -->
    <div class="absolute top-2 right-2">
      <UBadge :color="variantConfig.scoreBadgeColor" variant="solid" size="xs">
        Score: {{ center.performanceScore }}
      </UBadge>
    </div>

    <!-- Header -->
    <div class="flex items-start justify-between mb-4 pr-20">
      <div class="flex-1">
        <h3 class="text-lg font-bold text-highlighted mt-1">{{ center.centerName }}</h3>
        <UBadge
          :color="center.tier === 'A' ? 'success' : center.tier === 'B' ? 'warning' : 'error'"
          variant="outline"
          size="xs"
          class="mt-1"
        >
          Tier {{ center.tier }}
        </UBadge>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div :class="variantConfig.metricBoxClass">
        <p class="text-xs text-muted uppercase mb-1">Transfers</p>
        <p class="text-2xl font-bold text-highlighted">{{ center.totalTransfers }}</p>
        <UProgress :value="center.targetProgress" :color="variantConfig.progressColor" size="xs" class="mt-2" />
        <p class="text-xs text-muted mt-1">{{ center.targetProgress }}% of target</p>
      </div>

      <div :class="variantConfig.metricBoxClass">
        <p class="text-xs text-muted uppercase mb-1">Pending</p>
        <p class="text-2xl font-bold" :class="variantConfig.pendingTextClass">{{ center.pendingApproval }}</p>
      </div>

      <div :class="variantConfig.metricBoxClass">
        <p class="text-xs text-muted uppercase mb-1">DQ Rate</p>
        <p class="text-2xl font-bold" :class="variantConfig.dqTextClass">{{ center.dqRate }}%</p>
      </div>

      <div :class="variantConfig.metricBoxClass">
        <p class="text-xs text-muted uppercase mb-1">Approval %</p>
        <p class="text-2xl font-bold" :class="variantConfig.approvalTextClass">{{ center.approvalRatio }}%</p>
      </div>
    </div>

    <!-- Trend Indicator -->
    <div
      class="flex items-center justify-between pt-3 border-t"
      :class="variantConfig.trendBorderClass"
    >
      <span class="text-xs text-muted">vs Yesterday</span>
      <div class="flex items-center gap-1">
        <UIcon
          :name="center.trend > 0 ? 'i-lucide-trending-up' : center.trend < 0 ? 'i-lucide-trending-down' : 'i-lucide-minus'"
          :class="center.trend > 0 ? 'text-success' : center.trend < 0 ? 'text-error' : 'text-muted'"
          class="size-4"
        />
        <span
          :class="[
            'text-sm font-semibold',
            center.trend > 0 ? 'text-success' : center.trend < 0 ? 'text-error' : 'text-muted'
          ]"
        >
          {{ center.trend > 0 ? '+' : '' }}{{ center.trend }}%
        </span>
      </div>
    </div>
  </div>
</template>
