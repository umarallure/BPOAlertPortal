<script setup lang="ts">
import type { Database } from '~/types/database.types'

const supabase = useSupabaseClient<Database>()
const toast = useToast()

const activeTab = ref('rules')
const rules = ref<any[]>([])
const carriers = ref<any[]>([])
const loading = ref(false)
const q = ref('')

// Rule Modal State
const isRuleModalOpen = ref(false)
const selectedRule = ref<any>(null)

// Carrier Modal State
const isCarrierModalOpen = ref(false)
const selectedCarrier = ref<any>(null)
const isNewCarrier = ref(false)

const loadData = async () => {
  loading.value = true
  
  // Load Rules
  const { data: rulesData, error: rulesError } = await supabase
    .from('alert_rules')
    .select('*')
    .order('rule_name')
  
  if (rulesError) {
    toast.add({ title: 'Error loading rules', description: rulesError.message, color: 'red' })
  } else {
    rules.value = rulesData || []
  }

  // Load Carriers
  const { data: carriersData, error: carriersError } = await supabase
    .from('carrier_thresholds')
    .select('*')
    .order('carrier_name')

  if (carriersError) {
    toast.add({ title: 'Error loading carriers', description: carriersError.message, color: 'red' })
  } else {
    carriers.value = carriersData || []
  }

  loading.value = false
}

const filteredRules = computed(() => {
  if (!q.value) return rules.value
  return rules.value.filter(rule => 
    rule.rule_name.toLowerCase().includes(q.value.toLowerCase()) ||
    rule.rule_type.toLowerCase().includes(q.value.toLowerCase())
  )
})

const filteredCarriers = computed(() => {
  if (!q.value) return carriers.value
  return carriers.value.filter(carrier => 
    carrier.carrier_name.toLowerCase().includes(q.value.toLowerCase())
  )
})

const openRuleModal = (rule: any) => {
  selectedRule.value = JSON.parse(JSON.stringify(rule)) // Deep copy
  isRuleModalOpen.value = true
}

const saveRule = async () => {
  if (!selectedRule.value) return
  loading.value = true

  const { error } = await supabase
    .from('alert_rules')
    .update({
      alert_message_template: selectedRule.value.alert_message_template,
      condition_settings: selectedRule.value.condition_settings,
      is_active: selectedRule.value.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', selectedRule.value.id)

  if (error) {
    toast.add({ title: 'Error updating rule', description: error.message, color: 'red' })
  } else {
    toast.add({ title: 'Rule updated', color: 'green' })
    isRuleModalOpen.value = false
    await loadData()
  }
  loading.value = false
}

const openCarrierModal = (carrier: any = null) => {
  if (carrier) {
    selectedCarrier.value = { ...carrier }
    isNewCarrier.value = false
  } else {
    selectedCarrier.value = {
      carrier_name: '',
      underwriting_threshold: 5,
      is_active: true
    }
    isNewCarrier.value = true
  }
  isCarrierModalOpen.value = true
}

const saveCarrier = async () => {
  if (!selectedCarrier.value) return
  loading.value = true

  if (isNewCarrier.value) {
    const { error } = await supabase
      .from('carrier_thresholds')
      .insert({
        carrier_name: selectedCarrier.value.carrier_name,
        underwriting_threshold: selectedCarrier.value.underwriting_threshold,
        is_active: selectedCarrier.value.is_active
      })
    
    if (error) {
      toast.add({ title: 'Error creating carrier', description: error.message, color: 'red' })
    } else {
      toast.add({ title: 'Carrier created', color: 'green' })
      isCarrierModalOpen.value = false
      await loadData()
    }
  } else {
    const { error } = await supabase
      .from('carrier_thresholds')
      .update({
        carrier_name: selectedCarrier.value.carrier_name,
        underwriting_threshold: selectedCarrier.value.underwriting_threshold,
        is_active: selectedCarrier.value.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedCarrier.value.id)

    if (error) {
      toast.add({ title: 'Error updating carrier', description: error.message, color: 'red' })
    } else {
      toast.add({ title: 'Carrier updated', color: 'green' })
      isCarrierModalOpen.value = false
      await loadData()
    }
  }
  loading.value = false
}

const deleteCarrier = async (id: string) => {
  if (!confirm('Are you sure you want to delete this carrier threshold?')) return
  loading.value = true
  const { error } = await supabase.from('carrier_thresholds').delete().eq('id', id)
  if (error) {
    toast.add({ title: 'Error deleting carrier', description: error.message, color: 'red' })
  } else {
    toast.add({ title: 'Carrier deleted', color: 'green' })
    await loadData()
  }
  loading.value = false
}

const items = [{
  label: 'Alert Rules',
  slot: 'rules',
  key: 'rules'
}, {
  label: 'Carrier Thresholds',
  slot: 'carriers',
  key: 'carriers'
}]

onMounted(() => {
  loadData()
})
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Alert Configuration" :badge="rules.length + carriers.length">
      <template #right>
        <UInput
          v-model="q"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search..."
          class="hidden lg:block"
        />
        <UButton
          v-if="activeTab === 'carriers'"
          label="Add Carrier"
          trailing-icon="i-heroicons-plus"
          color="gray"
          @click="openCarrierModal()"
        />
      </template>
    </UDashboardNavbar>

    <UDashboardToolbar class="py-0 px-1.5 overflow-x-auto">
      <UTabs
        v-model="activeTab"
        :items="items"
        class="w-full"
        :ui="{ list: { background: '', tab: { background: '' } } }"
      >
        <template #rules>
           <!-- Rules Content -->
        </template>
        <template #carriers>
           <!-- Carriers Content -->
        </template>
      </UTabs>
    </UDashboardToolbar>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Rules Tab -->
      <UCard v-if="activeTab === 'rules' || activeTab === 0" :ui="{ body: { padding: '' } }">
        <UTable
          :rows="filteredRules"
          :columns="[
            { key: 'rule_name', label: 'Rule Name' },
            { key: 'rule_type', label: 'Type' },
            { key: 'priority', label: 'Priority' },
            { key: 'is_active', label: 'Status' },
            { key: 'actions', label: 'Actions' }
          ]"
        >
          <template #priority-data="{ row }">
            <UBadge
              :color="row.priority === 'critical' ? 'red' : row.priority === 'high' ? 'orange' : row.priority === 'medium' ? 'yellow' : 'green'"
              variant="subtle"
            >
              {{ row.priority }}
            </UBadge>
          </template>
          <template #is_active-data="{ row }">
            <UBadge
              :color="row.is_active ? 'green' : 'red'"
              variant="subtle"
            >
              {{ row.is_active ? 'Active' : 'Inactive' }}
            </UBadge>
          </template>
          <template #actions-data="{ row }">
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-pencil-square"
              @click="openRuleModal(row)"
            />
          </template>
        </UTable>
      </UCard>

      <!-- Carriers Tab -->
      <UCard v-if="activeTab === 'carriers' || activeTab === 1" :ui="{ body: { padding: '' } }">
        <UTable
          :rows="filteredCarriers"
          :columns="[
            { key: 'carrier_name', label: 'Carrier Name' },
            { key: 'underwriting_threshold', label: 'Underwriting Threshold' },
            { key: 'is_active', label: 'Status' },
            { key: 'actions', label: 'Actions' }
          ]"
        >
          <template #is_active-data="{ row }">
            <UBadge
              :color="row.is_active ? 'green' : 'red'"
              variant="subtle"
            >
              {{ row.is_active ? 'Active' : 'Inactive' }}
            </UBadge>
          </template>
          <template #actions-data="{ row }">
            <div class="flex gap-2">
              <UButton
                color="gray"
                variant="ghost"
                icon="i-heroicons-pencil-square"
                @click="openCarrierModal(row)"
              />
              <UButton
                color="red"
                variant="ghost"
                icon="i-heroicons-trash"
                @click="deleteCarrier(row.id)"
              />
            </div>
          </template>
        </UTable>
      </UCard>
    </div>

    <!-- Rule Modal -->
    <UModal v-model="isRuleModalOpen">
      <UCard v-if="selectedRule">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              Edit Rule: {{ selectedRule.rule_name }}
            </h3>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1" @click="isRuleModalOpen = false" />
          </div>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Message Template" help="Use {{ }} for placeholders.">
            <UTextarea v-model="selectedRule.alert_message_template" :rows="3" />
          </UFormGroup>

          <UFormGroup label="Condition Settings (JSON)">
            <UTextarea 
              :model-value="JSON.stringify(selectedRule.condition_settings, null, 2)"
              @update:model-value="val => { try { selectedRule.condition_settings = JSON.parse(val) } catch {} }"
              :rows="5"
              class="font-mono text-sm"
            />
          </UFormGroup>

          <UCheckbox v-model="selectedRule.is_active" label="Active" />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="isRuleModalOpen = false">Cancel</UButton>
            <UButton color="primary" @click="saveRule" :loading="loading">Save</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Carrier Modal -->
    <UModal v-model="isCarrierModalOpen">
      <UCard v-if="selectedCarrier">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              {{ isNewCarrier ? 'Add Carrier' : 'Edit Carrier' }}
            </h3>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1" @click="isCarrierModalOpen = false" />
          </div>
        </template>

        <div class="space-y-4">
          <UFormGroup label="Carrier Name">
            <UInput v-model="selectedCarrier.carrier_name" />
          </UFormGroup>

          <UFormGroup label="Underwriting Threshold">
            <UInput type="number" v-model="selectedCarrier.underwriting_threshold" />
          </UFormGroup>

          <UCheckbox v-model="selectedCarrier.is_active" label="Active" />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="isCarrierModalOpen = false">Cancel</UButton>
            <UButton color="primary" @click="saveCarrier" :loading="loading">Save</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

  </UDashboardPanel>
</template>
