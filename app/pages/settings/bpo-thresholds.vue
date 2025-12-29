<script setup lang="ts">
const supabase = useSupabaseClient()
const toast = useToast()

interface CenterThreshold {
  id: string
  center_name: string
  lead_vendor: string
  tier: 'A' | 'B' | 'C'
  daily_transfer_target: number
  daily_sales_target: number
  max_dq_percentage: number
  min_approval_ratio: number
  transfer_weight: number
  approval_ratio_weight: number
  dq_weight: number
  is_active: boolean
  slack_webhook_url?: string
  slack_channel?: string
  slack_manager_id?: string
}

const loading = ref(false)
const centers = ref<CenterThreshold[]>([])
const selectedCenter = ref<CenterThreshold | null>(null)
const isEditModalOpen = ref(false)
const editingRows = ref<Set<string>>(new Set())
const searchQuery = ref('')
const selectedTier = ref<string | null>(null)

const tierOptions: Array<{ label: string, value: 'A' | 'B' | 'C', color: 'success' | 'warning' | 'error' }> = [
  { label: 'Tier A - Premium', value: 'A', color: 'success' },
  { label: 'Tier B - Standard', value: 'B', color: 'warning' },
  { label: 'Tier C - Developing', value: 'C', color: 'error' }
]

const isEditing = (centerId: string) => editingRows.value.has(centerId)

const toggleEdit = (centerId: string) => {
  if (editingRows.value.has(centerId)) {
    editingRows.value.delete(centerId)
  } else {
    editingRows.value.add(centerId)
  }
}

const loadCenters = async () => {
  loading.value = true
  
  // Fetch thresholds
  const { data: thresholds, error: thresholdsError } = await supabase
    .from('center_thresholds')
    .select('*')
    .order('tier', { ascending: true })
    .order('center_name', { ascending: true })
  
  if (thresholdsError) {
    toast.add({
      title: 'Error loading centers',
      description: thresholdsError.message,
      color: 'error'
    })
    loading.value = false
    return
  }

  if (thresholds) {
    centers.value = thresholds
  }
  loading.value = false
}

const openEditModal = (center: CenterThreshold) => {
  selectedCenter.value = { ...center }
  isEditModalOpen.value = true
}

const saveCenter = async (center: CenterThreshold) => {
  loading.value = true
  
  // Update thresholds
  const { error: thresholdError } = await supabase
    .from('center_thresholds')
    .update({
      tier: center.tier,
      daily_transfer_target: center.daily_transfer_target,
      daily_sales_target: center.daily_sales_target,
      max_dq_percentage: center.max_dq_percentage,
      min_approval_ratio: center.min_approval_ratio,
      transfer_weight: center.transfer_weight,
      approval_ratio_weight: center.approval_ratio_weight,
      dq_weight: center.dq_weight,
      is_active: center.is_active,
      slack_webhook_url: center.slack_webhook_url,
      slack_channel: center.slack_channel,
      slack_manager_id: center.slack_manager_id,
      updated_at: new Date().toISOString()
    })
    .eq('id', center.id)
  
  if (thresholdError) {
    toast.add({
      title: 'Error saving center thresholds',
      description: thresholdError.message,
      color: 'error'
    })
  } else {
    toast.add({
      title: 'Center updated',
      description: `${center.center_name} has been updated successfully`,
      color: 'success'
    })
    editingRows.value.delete(center.id)
    await loadCenters()
  }
  loading.value = false
}

const getTierColor = (tier: string): 'success' | 'warning' | 'error' | 'neutral' => {
  const option = tierOptions.find(t => t.value === tier)
  return option?.color || 'neutral'
}

const totalWeight = computed(() => {
  if (!selectedCenter.value) return 0
  return selectedCenter.value.transfer_weight + selectedCenter.value.approval_ratio_weight + selectedCenter.value.dq_weight
})

const filteredCenters = computed(() => {
  let result = centers.value

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(center => 
      center.center_name.toLowerCase().includes(query) ||
      center.lead_vendor.toLowerCase().includes(query)
    )
  }

  // Filter by tier
  if (selectedTier.value) {
    result = result.filter(center => center.tier === selectedTier.value)
  }

  return result
})

onMounted(() => {
  loadCenters()
})
</script>

<template>
  <div>
    <div class="space-y-6 max-w-full">
      <div>
        <h2 class="text-xl font-semibold text-highlighted">BPO Center Thresholds</h2>
        <p class="text-sm text-muted mt-1">
          Configure performance targets and tier assignments for each BPO center
        </p>
      </div>

      <!-- Tier Legend -->
      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-highlighted">Tier Definitions</h3>
        </template>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex items-start gap-3 p-3 bg-success/5 rounded-lg border border-success/20">
            <div class="p-2 rounded-full bg-success/10">
              <UIcon name="i-lucide-trophy" class="text-success size-5" />
            </div>
            <div>
              <p class="font-semibold text-success">Tier A - Premium</p>
              <p class="text-xs text-muted mt-1">Top performers with highest targets and expectations</p>
            </div>
          </div>

          <div class="flex items-start gap-3 p-3 bg-warning/5 rounded-lg border border-warning/20">
            <div class="p-2 rounded-full bg-warning/10">
              <UIcon name="i-lucide-medal" class="text-warning size-5" />
            </div>
            <div>
              <p class="font-semibold text-warning">Tier B - Standard</p>
              <p class="text-xs text-muted mt-1">Established centers with moderate targets</p>
            </div>
          </div>

          <div class="flex items-start gap-3 p-3 bg-error/5 rounded-lg border border-error/20">
            <div class="p-2 rounded-full bg-error/10">
              <UIcon name="i-lucide-trending-up" class="text-error size-5" />
            </div>
            <div>
              <p class="font-semibold text-error">Tier C - Developing</p>
              <p class="text-xs text-muted mt-1">New or growing centers with baseline targets</p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Centers List -->
      <UCard :ui="{ body: '!p-0' }">
        <template #header>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-highlighted">Centers Configuration</h3>
              <UButton 
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                size="sm"
                :loading="loading"
                @click="loadCenters"
              >
                Refresh
              </UButton>
            </div>
            
            <!-- Search and Filter -->
            <div class="flex gap-3">
              <UInput
                v-model="searchQuery"
                icon="i-lucide-search"
                placeholder="Search by center name or lead vendor..."
                class="flex-1"
                size="sm"
              />
              <USelectMenu
                v-model="selectedTier"
                :items="[
                  { label: 'All Tiers', value: null },
                  { label: 'Tier A', value: 'A' },
                  { label: 'Tier B', value: 'B' },
                  { label: 'Tier C', value: 'C' }
                ]"
                label-key="label"
                value-key="value"
                placeholder="Filter by tier"
                size="sm"
                class="w-48"
              />
            </div>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-muted/5 border-b border-default">
              <tr>
                <th class="text-left text-xs font-semibold text-muted uppercase px-4 py-3 sticky left-0 bg-muted/5 z-10">Center Name</th>
                <th class="text-center text-xs font-semibold text-muted uppercase px-4 py-3">Tier</th>
                <th class="text-center text-xs font-semibold text-muted uppercase px-4 py-3">Transfer Target</th>
                <th class="text-center text-xs font-semibold text-muted uppercase px-4 py-3">Sales Target</th>
                <th class="text-center text-xs font-semibold text-muted uppercase px-4 py-3">Max DQ %</th>
                <th class="text-center text-xs font-semibold text-muted uppercase px-4 py-3">Min Approval %</th>
                <th class="text-center text-xs font-semibold text-muted uppercase px-4 py-3">Slack Config</th>
                <th class="text-center text-xs font-semibold text-muted uppercase px-4 py-3">Status</th>
                <th class="text-right text-xs font-semibold text-muted uppercase px-4 py-3 sticky right-0 bg-muted/5 z-10">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredCenters.length === 0">
                <td colspan="8" class="px-4 py-8 text-center">
                  <div class="flex flex-col items-center gap-2">
                    <UIcon name="i-lucide-search-x" class="size-8 text-muted" />
                    <p class="text-sm text-muted">No centers found matching your search criteria</p>
                    <UButton 
                      v-if="searchQuery || selectedTier"
                      variant="ghost" 
                      size="sm"
                      @click="searchQuery = ''; selectedTier = null"
                    >
                      Clear filters
                    </UButton>
                  </div>
                </td>
              </tr>
              <tr 
                v-for="center in filteredCenters" 
                :key="center.id"
                class="border-b border-default hover:bg-muted/5 transition-colors"
              >
                <td class="px-4 py-3 sticky left-0 bg-card hover:bg-muted/5 z-10">
                  <p class="font-medium text-highlighted">{{ center.center_name }}</p>
                  <p class="text-xs text-muted">{{ center.lead_vendor }}</p>
                </td>
                <td class="px-4 py-3 text-center">
                  <USelectMenu
                    v-if="isEditing(center.id)"
                    v-model="center.tier"
                    :items="tierOptions"
                    label-key="label"
                    value-key="value"
                    size="sm"
                  />
                  <UBadge v-else :color="getTierColor(center.tier)" variant="subtle">
                    Tier {{ center.tier }}
                  </UBadge>
                </td>
                <td class="px-4 py-3 text-center">
                  <UInput
                    v-if="isEditing(center.id)"
                    v-model.number="center.daily_transfer_target"
                    type="number"
                    :min="1"
                    size="sm"
                    class="max-w-[100px] mx-auto"
                  />
                  <span v-else class="font-semibold">{{ center.daily_transfer_target }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <UInput
                    v-if="isEditing(center.id)"
                    v-model.number="center.daily_sales_target"
                    type="number"
                    :min="1"
                    size="sm"
                    class="max-w-[100px] mx-auto"
                  />
                  <span v-else class="font-semibold">{{ center.daily_sales_target }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <UInput
                    v-if="isEditing(center.id)"
                    v-model.number="center.max_dq_percentage"
                    type="number"
                    step="0.5"
                    :min="0"
                    :max="100"
                    size="sm"
                    class="max-w-[100px] mx-auto"
                  />
                  <span v-else class="font-semibold">{{ center.max_dq_percentage }}%</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <UInput
                    v-if="isEditing(center.id)"
                    v-model.number="center.min_approval_ratio"
                    type="number"
                    step="0.5"
                    :min="0"
                    :max="100"
                    size="sm"
                    class="max-w-[100px] mx-auto"
                  />
                  <span v-else class="font-semibold">{{ center.min_approval_ratio }}%</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <div v-if="isEditing(center.id)" class="space-y-2 min-w-[200px]">
                    <UInput
                      v-model="center.slack_webhook_url"
                      placeholder="Webhook URL"
                      size="sm"
                      type="password"
                    />
                    <UInput
                      v-model="center.slack_channel"
                      placeholder="#channel"
                      size="sm"
                    />
                    <UInput
                      v-model="center.slack_manager_id"
                      placeholder="Manager Slack ID (U12345678)"
                      size="sm"
                    />
                  </div>
                  <div v-else class="flex flex-col items-center gap-1">
                    <UBadge v-if="center.slack_webhook_url" color="primary" variant="subtle" size="xs">
                      <UIcon name="i-lucide-bell" class="mr-1" /> Configured
                    </UBadge>
                    <span v-else class="text-xs text-muted">Not configured</span>
                    <span v-if="center.slack_channel" class="text-xs text-muted">{{ center.slack_channel }}</span>
                    <span v-if="center.slack_manager_id" class="text-xs text-muted">@{{ center.slack_manager_id }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-center">
                  <UToggle
                    v-if="isEditing(center.id)"
                    v-model="center.is_active"
                    size="sm"
                  />
                  <UBadge v-else :color="center.is_active ? 'success' : 'error'" variant="subtle">
                    {{ center.is_active ? 'Active' : 'Inactive' }}
                  </UBadge>
                </td>
                <td class="px-4 py-3 text-right sticky right-0 bg-card hover:bg-muted/5 z-10">
                  <div class="flex gap-2 justify-end">
                    <UButton
                      v-if="isEditing(center.id)"
                      icon="i-lucide-save"
                      color="primary"
                      variant="soft"
                      size="sm"
                      :loading="loading"
                      @click="saveCenter(center)"
                    >
                      Save
                    </UButton>
                    <UButton
                      v-if="isEditing(center.id)"
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="toggleEdit(center.id); loadCenters()"
                    >
                      Cancel
                    </UButton>
                    <UButton
                      v-else
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="toggleEdit(center.id)"
                    >
                      Edit
                    </UButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </div>
</template>
