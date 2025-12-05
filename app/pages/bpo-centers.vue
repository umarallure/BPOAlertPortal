<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Period, Range } from '~/types'

const { isNotificationsSlideoverOpen } = useDashboard()

const items = [[{
  label: 'Export Report',
  icon: 'i-lucide-download',
}, {
  label: 'View Details',
  icon: 'i-lucide-list'
}]] satisfies DropdownMenuItem[][]

const today = new Date()
const range = shallowRef<Range>({
  start: today,
  end: today
})
const period = ref<Period>('daily')
</script>

<template>
  <UDashboardPanel id="bpo-centers">
    <template #header>
      <UDashboardNavbar title="BPO Center Performance" :ui="{ right: 'gap-3' }">
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
        <!-- BPO Center Cards Section -->
        <div>
          <h2 class="text-lg font-semibold text-highlighted mb-4">Center Performance</h2>
          <BpoCenterCards :period="period" :range="range" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
