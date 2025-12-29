<script setup lang="ts">
import { DateFormatter, CalendarDate, today, type DateValue } from '@internationalized/date'
import { onMounted, watch } from 'vue'
import type { Range } from '~/types'
import { clampToPreviousWorkingDay, getLastNWorkingDates, getWorkingDatesBetween } from '~/utils/workingDays'

const df = new DateFormatter('en-US', {
  dateStyle: 'medium'
})

const selected = defineModel<Range>({ required: true })

const mode = ref<'single' | 'range'>('range')

const isSunday = (date: Date) => date.getDay() === 0

const clampToNonSundayCalendarDate = (date: CalendarDate) => {
  const js = date.toDate('America/New_York')
  if (!isSunday(js)) return date
  return date.subtract({ days: 1 })
}

const clampToNonSundayDate = (date: Date) => {
  if (!isSunday(date)) return date
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return d
}

const clampModelToNonSunday = () => {
  const start = selected.value.start
  const end = selected.value.end
  if (!start && !end) return

  const safeStart = start ? clampToNonSundayDate(start) : undefined
  const safeEnd = end ? clampToNonSundayDate(end) : undefined

  if (safeStart !== start || safeEnd !== end) {
    selected.value = {
      start: safeStart || clampToNonSundayDate(new Date()),
      end: safeEnd || safeStart || clampToNonSundayDate(new Date())
    }
  }
}

// Watch mode changes to reset calendar selection
watch(mode, (newMode) => {
  if (newMode === 'single') {
    // For single mode, ensure we have a single date
    const currentDate = clampToNonSundayDate(selected.value.start || new Date())
    selected.value = {
      start: currentDate,
      end: currentDate
    }
  }
})

onMounted(() => {
  clampModelToNonSunday()
})

watch(
  () => [selected.value.start, selected.value.end],
  () => {
    clampModelToNonSunday()
  }
)

const ranges = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', months: 3 },
  { label: 'Last 6 months', months: 6 },
  { label: 'Last year', years: 1 }
]

const toCalendarDate = (date: Date) => {
  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
}

const calendarRange = computed({
  get: () => ({
    start: selected.value.start ? toCalendarDate(selected.value.start) : undefined,
    end: selected.value.end ? toCalendarDate(selected.value.end) : undefined
  }),
  set: (newValue: { start: CalendarDate | null, end: CalendarDate | null }) => {
    if (mode.value === 'single') {
      // For single date, set both start and end to the selected date
      const date = newValue.start || newValue.end
      if (date) {
        const safeDate = clampToNonSundayCalendarDate(date)
        selected.value = {
          start: safeDate.toDate('America/New_York'),
          end: safeDate.toDate('America/New_York')
        }
      }
    } else {
      const safeStart = newValue.start ? clampToNonSundayCalendarDate(newValue.start) : null
      const safeEnd = newValue.end ? clampToNonSundayCalendarDate(newValue.end) : null
      selected.value = {
        start: safeStart ? safeStart.toDate('America/New_York') : clampToNonSundayDate(new Date()),
        end: safeEnd ? safeEnd.toDate('America/New_York') : clampToNonSundayDate(new Date())
      }
    }
  }
})

const isRangeSelected = (range: { days?: number, months?: number, years?: number }) => {
  if (!selected.value.start || !selected.value.end) return false

  const end = clampToPreviousWorkingDay(today('America/New_York').toDate('America/New_York'))

  let workingDates: Date[] = []
  if (range.days !== undefined) {
    const n = Math.max(1, range.days || 1)
    workingDates = getLastNWorkingDates(end, n)
  } else if (range.months) {
    const startCandidate = today('America/New_York').subtract({ months: range.months }).toDate('America/New_York')
    workingDates = getWorkingDatesBetween(startCandidate, end)
  } else if (range.years) {
    const startCandidate = today('America/New_York').subtract({ years: range.years }).toDate('America/New_York')
    workingDates = getWorkingDatesBetween(startCandidate, end)
  }

  if (!workingDates.length) {
    workingDates = [end]
  }

  const expectedStart = toCalendarDate(workingDates[0]!)
  const expectedEnd = toCalendarDate(workingDates[workingDates.length - 1]!)
  const selectedStart = toCalendarDate(selected.value.start)
  const selectedEnd = toCalendarDate(selected.value.end)

  return selectedStart.compare(expectedStart) === 0 && selectedEnd.compare(expectedEnd) === 0
}

const selectRange = (range: { days?: number, months?: number, years?: number }) => {
  const end = clampToPreviousWorkingDay(today('America/New_York').toDate('America/New_York'))

  let workingDates: Date[] = []
  if (range.days !== undefined) {
    const n = Math.max(1, range.days || 1)
    workingDates = getLastNWorkingDates(end, n)
  } else if (range.months) {
    const startCandidate = today('America/New_York').subtract({ months: range.months }).toDate('America/New_York')
    workingDates = getWorkingDatesBetween(startCandidate, end)
  } else if (range.years) {
    const startCandidate = today('America/New_York').subtract({ years: range.years }).toDate('America/New_York')
    workingDates = getWorkingDatesBetween(startCandidate, end)
  }

  if (!workingDates.length) {
    workingDates = [end]
  }

  selected.value = {
    start: workingDates[0]!,
    end: workingDates[workingDates.length - 1]!
  }
}

const selectSingleDate = (date: CalendarDate) => {
  const jsDate = clampToNonSundayDate(date.toDate('America/New_York'))
  selected.value = {
    start: jsDate,
    end: jsDate
  }
}

const isCalendarSunday = (date: DateValue) => {
  return isSunday(date.toDate('America/New_York'))
}
</script>

<template>
  <UPopover :content="{ align: 'start' }">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-calendar"
      class="data-[state=open]:bg-elevated group"
    >
      <span class="truncate">
        <template v-if="selected.start">
          <template v-if="selected.end && selected.start.getTime() !== selected.end.getTime()">
            {{ df.format(selected.start) }} - {{ df.format(selected.end) }}
          </template>
          <template v-else>
            {{ df.format(selected.start) }}
          </template>
        </template>
        <template v-else>
          Pick a date
        </template>
      </span>

      <template #trailing>
        <UIcon name="i-lucide-chevron-down" class="shrink-0 text-dimmed size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
      </template>
    </UButton>

    <template #content>
      <div class="p-4">
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-medium">Selection Mode</span>
          <div class="flex rounded-md border border-default">
            <UButton
              :variant="mode === 'single' ? 'subtle' : 'ghost'"
              size="xs"
              class="rounded-r-none border-r border-default"
              @click="mode = 'single'"
            >
              Single
            </UButton>
            <UButton
              :variant="mode === 'range' ? 'subtle' : 'ghost'"
              size="xs"
              class="rounded-l-none"
              @click="mode = 'range'"
            >
              Range
            </UButton>
          </div>
        </div>

        <div class="flex items-stretch sm:divide-x divide-default">
          <div class="hidden sm:flex flex-col justify-center pr-4">
            <template v-if="mode === 'range'">
              <UButton
                v-for="(range, index) in ranges"
                :key="index"
                :label="range.label"
                color="neutral"
                variant="ghost"
                class="rounded-none px-4"
                :class="[isRangeSelected(range) ? 'bg-elevated' : 'hover:bg-elevated/50']"
                truncate
                @click="selectRange(range)"
              />
            </template>
            <template v-else-if="mode === 'single'">
              <UButton
                label="Today"
                color="neutral"
                variant="ghost"
                class="rounded-none px-4 hover:bg-elevated/50"
                @click="selectSingleDate(today('America/New_York'))"
              />
              <UButton
                label="Yesterday"
                color="neutral"
                variant="ghost"
                class="rounded-none px-4 hover:bg-elevated/50"
                @click="selectSingleDate(today('America/New_York').subtract({ days: 1 }))"
              />
            </template>
          </div>

          <UCalendar
            v-model="calendarRange"
            class="p-2"
            :range="mode === 'range'"
            :number-of-months="mode === 'range' ? 2 : 1"
            :is-date-disabled="isCalendarSunday"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
