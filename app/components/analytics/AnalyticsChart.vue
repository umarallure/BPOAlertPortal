<script setup lang="ts">
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import { eachDayOfInterval } from 'date-fns'
import type { Period, Range } from '~/types'

const props = defineProps<{
  title: string
  period: Period
  range: Range
}>()

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

type DataRecord = {
  date: Date
  value1: number
  value2: number
}

const data = ref<DataRecord[]>([])

watch([() => props.period, () => props.range], () => {
  const dates = eachDayOfInterval(props.range)
  
  data.value = dates.map(date => ({
    date,
    value1: Math.floor(Math.random() * 100) + 30,
    value2: Math.floor(Math.random() * 80) + 20
  }))
}, { immediate: true })

const x = (_: DataRecord, i: number) => i
const y1 = (d: DataRecord) => d.value1
const y2 = (d: DataRecord) => d.value2

const xTicks = (i: number) => {
  if (i === 0 || i === data.value.length - 1 || !data.value[i]) {
    return ''
  }
  const d = data.value[i].date
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const template = (d: DataRecord) => `${d.date.toLocaleDateString()}<br/>Total: ${d.value1}<br/>Approved: ${d.value2}`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <p class="text-sm font-semibold text-highlighted">
        {{ title }}
      </p>
    </template>

    <VisXYContainer
      :data="data"
      :padding="{ top: 40 }"
      class="h-72"
      :width="width"
    >
      <VisLine
        :x="x"
        :y="y1"
        color="var(--ui-primary)"
        name="Total"
      />
      <VisLine
        :x="x"
        :y="y2"
        color="var(--ui-success)"
        name="Metric"
      />
      
      <VisArea
        :x="x"
        :y="y1"
        color="var(--ui-primary)"
        :opacity="0.1"
      />

      <VisAxis
        type="x"
        :x="x"
        :tick-format="xTicks"
      />

      <VisCrosshair
        color="var(--ui-primary)"
        :template="template"
      />

      <VisTooltip />
    </VisXYContainer>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
