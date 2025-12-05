<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { sub } from 'date-fns'
import type { Period, Range } from '~/types'

const { isNotificationsSlideoverOpen } = useDashboard()

const items = [[{
  label: 'Export Report',
  icon: 'i-lucide-download',
}, {
  label: 'View Details',
  icon: 'i-lucide-list'
}]] satisfies DropdownMenuItem[][]

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 30 }),
  end: new Date()
})
const period = ref<Period>('daily')

definePageMeta({
  name: 'home'
})
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Analytics" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UTooltip text="Notifications" :shortcuts="['N']">
            <UButton
              color="neutral"
              variant="ghost"
              square
              @click="isNotificationsSlideoverOpen = true"
            >
              <UChip color="error" inset>
                <UIcon name="i-lucide-bell" class="size-5 shrink-0" />
              </UChip>
            </UButton>
          </UTooltip>

          <UDropdownMenu :items="items">
            <UButton icon="i-lucide-more-horizontal" color="neutral" variant="ghost" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <HomeDateRangePicker v-model="range" class="-ms-1" />

          <HomePeriodSelect v-model="period" :range="range" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Key Metrics Section -->
        <div>
          <h2 class="text-lg font-semibold text-highlighted mb-4">Key Metrics</h2>
          <AnalyticsStats :period="period" :range="range" />
        </div>

        <!-- Performance Section -->
        <div>
          <h2 class="text-lg font-semibold text-highlighted mb-4">Performance Rates</h2>
          <AnalyticsRates :period="period" :range="range" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
