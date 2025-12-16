<script setup lang="ts">
type Carrier = {
  id: string
  carrier_name: string
  carrier_code: string | null
  is_active: boolean | null
  display_order: number | null
  notes: string | null
}

const route = useRoute()
const carrierName = computed(() => decodeURIComponent(String(route.params.carrier_name || '')))

const supabase = useSupabaseClient()

const carrier = ref<Carrier | null>(null)
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const error = ref<Error | null>(null)

const loadCarrier = async () => {
  status.value = 'pending'
  error.value = null
  carrier.value = null

  if (!carrierName.value) {
    status.value = 'error'
    error.value = new Error('carrier_name is required')
    return
  }

  const { data, error: sbError } = await supabase
    .from('carriers')
    .select('id, carrier_name, carrier_code, is_active, display_order, notes')
    .eq('carrier_name', carrierName.value)
    .maybeSingle()

  if (sbError) {
    status.value = 'error'
    error.value = sbError
    return
  }

  carrier.value = (data || null) as Carrier | null
  status.value = 'success'
}

const refresh = async () => {
  await loadCarrier()
}

onMounted(() => {
  loadCarrier()
})

watch(carrierName, () => {
  loadCarrier()
})
</script>

<template>
  <UDashboardPanel id="on-boarding-guide-carrier-detail">
    <template #header>
      <UDashboardNavbar :title="carrierName || 'Carrier'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="Back"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="outline"
              size="xs"
              to="/on-boarding-guide/carriers"
            />
            <UButton
              label="Refresh"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              size="xs"
              @click="() => refresh()"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-highlighted">Carrier Details</h2>
                <p class="text-sm text-muted">Details loaded from the carriers table.</p>
              </div>

              <UBadge
                v-if="carrier?.is_active !== null"
                :color="carrier?.is_active ? 'success' : 'error'"
                variant="subtle"
              >
                {{ carrier?.is_active ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
          </template>

          <div v-if="status === 'pending'" class="text-sm text-muted">Loading carrier...</div>

          <div v-else-if="error" class="text-sm text-muted">
            {{ error.message }}
          </div>

          <div v-else-if="!carrier" class="text-sm text-muted">Carrier not found.</div>

          <div v-else class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-muted">Carrier Name</div>
                <div class="text-sm font-medium text-highlighted">{{ carrier.carrier_name }}</div>
              </div>

              <div>
                <div class="text-xs text-muted">Carrier Code</div>
                <div class="text-sm font-medium text-highlighted">{{ carrier.carrier_code || '—' }}</div>
              </div>

              <div>
                <div class="text-xs text-muted">Display Order</div>
                <div class="text-sm font-medium text-highlighted">{{ carrier.display_order ?? '—' }}</div>
              </div>

              <div>
                <div class="text-xs text-muted">Status</div>
                <div class="text-sm font-medium text-highlighted">{{ carrier.is_active === null ? '—' : (carrier.is_active ? 'Active' : 'Inactive') }}</div>
              </div>
            </div>

            <div>
              <div class="text-xs text-muted">Notes</div>
              <div class="text-sm text-highlighted whitespace-pre-line">{{ carrier.notes || '—' }}</div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
