<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AlertRule } from '~/types'

const supabase = useSupabaseClient()
const toast = useToast()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

interface CarrierThreshold {
  id: string
  carrier_name: string
  underwriting_threshold: number
  is_active: boolean
}

const loading = ref(false)
const rules = ref<AlertRule[]>([])
const carriers = ref<CarrierThreshold[]>([])
const activeTab = ref('rules')

// Modal states
const isRuleModalOpen = ref(false)
const selectedRule = ref<AlertRule | null>(null)
const isNewRule = ref(false)

const isCarrierModalOpen = ref(false)
const selectedCarrier = ref<CarrierThreshold | null>(null)
const isNewCarrier = ref(false)

const openRuleModal = (rule?: AlertRule) => {
  if (rule) {
    selectedRule.value = { ...rule } // Clone
    isNewRule.value = false
  } else {
    // Create new rule
    selectedRule.value = {
      id: '',
      rule_name: '',
      rule_type: '',
      description: '',
      alert_message_template: '',
      condition_settings: {},
      is_active: true,
      channels: [],
      recipients: [],
      priority: 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as AlertRule
    isNewRule.value = true
  }
  isRuleModalOpen.value = true
}

const openCarrierModal = (carrier?: CarrierThreshold) => {
  if (carrier) {
    selectedCarrier.value = { ...carrier }
    isNewCarrier.value = false
  } else {
    selectedCarrier.value = {
      id: '',
      carrier_name: '',
      underwriting_threshold: 5,
      is_active: true
    }
    isNewCarrier.value = true
  }
  isCarrierModalOpen.value = true
}

const deleteCarrier = async (id: string) => {
  if (!confirm('Are you sure you want to delete this carrier threshold?')) return
  loading.value = true
  const { error } = await supabase.from('carrier_thresholds').delete().eq('id', id)
  if (error) {
    toast.add({ title: 'Error deleting carrier', description: error.message, color: 'error' })
  } else {
    toast.add({ title: 'Carrier deleted', color: 'success' })
    await loadData()
  }
  loading.value = false
}

const rulesColumns: TableColumn<AlertRule>[] = [
  { accessorKey: 'rule_name', header: 'Rule Name' },
  { accessorKey: 'rule_type', header: 'Type' },
  {
    accessorKey: 'priority',
    header: 'Priority',
    cell: ({ row }) => {
      const priority = row.original.priority
      const color = priority === 'critical' ? 'red' : priority === 'high' ? 'orange' : priority === 'medium' ? 'yellow' : 'green'
      return h(UBadge, { color, variant: 'subtle' }, () => priority)
    }
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => {
      const isActive = row.original.is_active
      return h(UBadge, { color: isActive ? 'green' : 'red', variant: 'subtle' }, () => isActive ? 'Active' : 'Inactive')
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      return h(UButton, {
        color: 'gray',
        variant: 'ghost',
        icon: 'i-heroicons-pencil-square-20-solid',
        onClick: () => openRuleModal(row.original)
      })
    }
  }
]

const carriersColumns: TableColumn<CarrierThreshold>[] = [
  { accessorKey: 'carrier_name', header: 'Carrier Name' },
  { accessorKey: 'underwriting_threshold', header: 'Underwriting Threshold' },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => {
      const isActive = row.original.is_active
      return h(UBadge, { color: isActive ? 'green' : 'red', variant: 'subtle' }, () => isActive ? 'Active' : 'Inactive')
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      return h('div', { class: 'flex gap-2' }, [
        h(UButton, {
          color: 'gray',
          variant: 'ghost',
          icon: 'i-heroicons-pencil-square-20-solid',
          onClick: () => openCarrierModal(row.original)
        }),
        h(UButton, {
          color: 'red',
          variant: 'ghost',
          icon: 'i-heroicons-trash-20-solid',
          onClick: () => deleteCarrier(row.original.id)
        })
      ])
    }
  }
]

const loadData = async () => {
  loading.value = true
  
  // Load Rules
  const { data: rulesData, error: rulesError } = await supabase
    .from('alert_rules')
    .select('*')
    .order('rule_name')
  
  if (rulesError) {
    toast.add({ title: 'Error loading rules', description: rulesError.message, color: 'error' })
  } else {
    rules.value = rulesData
  }

  // Load Carriers
  const { data: carriersData, error: carriersError } = await supabase
    .from('carrier_thresholds')
    .select('*')
    .order('carrier_name')

  if (carriersError) {
    toast.add({ title: 'Error loading carriers', description: carriersError.message, color: 'error' })
  } else {
    carriers.value = carriersData
  }

  loading.value = false
}

const saveRule = async (updatedRule: Partial<AlertRule>) => {
  if (!selectedRule.value) return
  loading.value = true

  if (isNewRule.value) {
    // Create new rule
    const { data, error } = await supabase
      .from('alert_rules')
      .insert({
        rule_name: updatedRule.rule_name,
        rule_type: updatedRule.rule_type,
        description: updatedRule.description,
        alert_message_template: updatedRule.alert_message_template,
        condition_settings: updatedRule.condition_settings,
        is_active: updatedRule.is_active,
        channels: updatedRule.channels,
        recipients: updatedRule.recipients,
        priority: updatedRule.priority || 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')

    if (error) {
      toast.add({ title: 'Error creating rule', description: error.message, color: 'error' })
    } else if (!data || data.length === 0) {
      toast.add({
        title: 'Not saved',
        description: 'No record was created. This is often caused by missing permissions (RLS) or an invalid payload.',
        color: 'error'
      })
    } else {
      toast.add({ title: 'Rule created', color: 'success' })
      isRuleModalOpen.value = false
      await loadData()
    }
  } else {
    // Update existing rule
    const { data, error } = await supabase
      .from('alert_rules')
      .update({
        rule_name: updatedRule.rule_name,
        rule_type: updatedRule.rule_type,
        description: updatedRule.description,
        alert_message_template: updatedRule.alert_message_template,
        condition_settings: updatedRule.condition_settings,
        is_active: updatedRule.is_active,
        channels: updatedRule.channels,
        recipients: updatedRule.recipients,
        priority: updatedRule.priority,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedRule.value.id)
      .select('id')

    if (error) {
      toast.add({ title: 'Error saving rule', description: error.message, color: 'error' })
    } else if (!data || data.length === 0) {
      toast.add({
        title: 'Not saved',
        description: 'No record was updated. This is often caused by missing permissions (RLS) or the record not being found.',
        color: 'error'
      })
      console.log('[alert-rules] update returned no rows', {
        id: selectedRule.value.id,
        payloadKeys: Object.keys(updatedRule || {})
      })
    } else {
      toast.add({ title: 'Rule updated', color: 'success' })
      isRuleModalOpen.value = false
      await loadData()
    }
  }
  loading.value = false
}

const saveCarrier = async (updatedCarrier: Partial<CarrierThreshold>) => {
  loading.value = true

  if (isNewCarrier.value) {
    const { error } = await supabase
      .from('carrier_thresholds')
      .insert({
        carrier_name: updatedCarrier.carrier_name,
        underwriting_threshold: updatedCarrier.underwriting_threshold,
        is_active: updatedCarrier.is_active
      })
    
    if (error) {
      toast.add({ title: 'Error creating carrier', description: error.message, color: 'error' })
    } else {
      toast.add({ title: 'Carrier created', color: 'success' })
      isCarrierModalOpen.value = false
      await loadData()
    }
  } else {
    if (!selectedCarrier.value) return
    const { error } = await supabase
      .from('carrier_thresholds')
      .update({
        carrier_name: updatedCarrier.carrier_name,
        underwriting_threshold: updatedCarrier.underwriting_threshold,
        is_active: updatedCarrier.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedCarrier.value.id)

    if (error) {
      toast.add({ title: 'Error updating carrier', description: error.message, color: 'error' })
    } else {
      toast.add({ title: 'Carrier updated', color: 'success' })
      isCarrierModalOpen.value = false
      await loadData()
    }
  }
  loading.value = false
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <UDashboardPanel id="alert-rules">
    <template #header>
      <UDashboardNavbar title="Alert Configuration" :badge="activeTab === 'rules' ? rules.length : carriers.length">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex gap-2">
            <UButton
              label="Alert Rules"
              :variant="activeTab === 'rules' ? 'solid' : 'ghost'"
              color="gray"
              @click="activeTab = 'rules'"
            />
            <UButton
              label="Carrier Thresholds"
              :variant="activeTab === 'carriers' ? 'solid' : 'ghost'"
              color="gray"
              @click="activeTab = 'carriers'"
            />
          </div>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <!-- Search or filters could go here -->
        </template>
        <template #right>
          <UButton
            v-if="activeTab === 'rules'"
            label="Add Alert Rule"
            icon="i-heroicons-plus"
            @click="openRuleModal()"
          />
          <UButton
            v-if="activeTab === 'carriers'"
            label="Add Carrier Threshold"
            icon="i-heroicons-plus"
            @click="openCarrierModal()"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UTable
        v-if="activeTab === 'rules'"
        :data="rules"
        :columns="rulesColumns"
        :loading="loading"
        class="w-full"
      />

      <UTable
        v-if="activeTab === 'carriers'"
        :data="carriers"
        :columns="carriersColumns"
        :loading="loading"
        class="w-full"
      />

      <SettingsAlertRuleModal
        v-model:open="isRuleModalOpen"
        :rule="selectedRule"
        @save="saveRule"
      />

      <SettingsCarrierModal
        v-model:open="isCarrierModalOpen"
        :carrier="selectedCarrier"
        @save="saveCarrier"
      />
    </template>
  </UDashboardPanel>
</template>
