<script setup lang="ts">
type Carrier = {
  id: string
  carrier_name: string
  carrier_code: string | null
  is_active: boolean | null
  display_order: number | null
  notes: string | null
}

const supabase = useSupabaseClient()

const carriers = ref<Carrier[]>([])
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const error = ref<Error | null>(null)

const loadCarriers = async () => {
  status.value = 'pending'
  error.value = null

  const { data, error: sbError } = await supabase
    .from('carriers')
    .select('id, carrier_name, carrier_code, is_active, display_order, notes')
    .order('display_order', { ascending: true })
    .order('carrier_name', { ascending: true })

  if (sbError) {
    status.value = 'error'
    error.value = sbError
    carriers.value = []
    return
  }

  carriers.value = (data || []) as Carrier[]
  status.value = 'success'
}

const refresh = async () => {
  await loadCarriers()
}

onMounted(() => {
  loadCarriers()
})
</script>

<template>
  <UDashboardPanel id="on-boarding-guide-carriers">
    <template #header>
      <UDashboardNavbar title="On Boarding Guide">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Refresh"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            size="xs"
            @click="() => refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-highlighted">Carriers</h2>
                <p class="text-sm text-muted">Click a carrier to view details.</p>
              </div>
            </div>
          </template>

          <div v-if="status === 'pending'" class="p-4 text-sm text-muted">Loading carriers...</div>
          <div v-else-if="status === 'error'" class="p-4 text-sm text-muted">
            {{ error?.message || 'Error loading carriers.' }}
          </div>
          <div v-else-if="!carriers.length" class="p-4 text-sm text-muted">No carriers found.</div>

          <div v-else class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NuxtLink
              v-for="carrier in carriers"
              :key="carrier.id"
              :to="`/on-boarding-guide/carriers/${encodeURIComponent(carrier.carrier_name)}`"
              class="block"
            >
              <UCard class="hover:bg-elevated/50 transition-colors">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-highlighted truncate">{{ carrier.carrier_name }}</div>
                    <div v-if="carrier.carrier_code" class="text-xs text-muted">{{ carrier.carrier_code }}</div>
                  </div>

                  <UBadge
                    v-if="carrier.is_active !== null"
                    :color="carrier.is_active ? 'success' : 'error'"
                    variant="subtle"
                  >
                    {{ carrier.is_active ? 'Active' : 'Inactive' }}
                  </UBadge>
                </div>

                <div v-if="carrier.notes" class="mt-3 text-sm text-muted line-clamp-3">
                  {{ carrier.notes }}
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
