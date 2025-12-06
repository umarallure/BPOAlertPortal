<script setup lang="ts">
import type { AlertRule } from '~/types'

const props = defineProps<{
  rule?: AlertRule | null
}>()

const emit = defineEmits(['save', 'update:open'])

const open = defineModel<boolean>('open')

const state = ref<Partial<AlertRule>>({
  rule_name: '',
  description: '',
  alert_message_template: '',
  condition_settings: {},
  is_active: true,
  channels: [],
  recipients: []
})

watch(() => props.rule, (newRule) => {
  if (newRule) {
    state.value = { ...newRule }
  } else {
    state.value = {
      rule_name: '',
      description: '',
      alert_message_template: '',
      condition_settings: {},
      is_active: true,
      channels: [],
      recipients: []
    }
  }
}, { immediate: true })

const channelsInput = computed({
  get: () => state.value.channels?.join(', ') || '',
  set: (val) => {
    state.value.channels = val.split(',').map(s => s.trim()).filter(Boolean)
  }
})

const recipientsInput = computed({
  get: () => state.value.recipients?.join(', ') || '',
  set: (val) => {
    state.value.recipients = val.split(',').map(s => s.trim()).filter(Boolean)
  }
})

const onSave = () => {
  emit('save', state.value)
}
</script>

<template>
  <UModal v-model:open="open" :title="rule ? 'Edit Rule' : 'New Rule'" :description="rule ? `Edit ${rule.rule_name}` : 'Create a new alert rule'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Rule Name">
          <UInput v-model="state.rule_name" class="w-full" />
        </UFormField>

        <UFormField label="Description">
          <UInput v-model="state.description" class="w-full" />
        </UFormField>

        <UFormField label="Message Template" help="Use {{ }} for placeholders.">
          <UTextarea v-model="state.alert_message_template" :rows="3" class="w-full" />
        </UFormField>

        <UFormField label="Channels" help="Comma separated (e.g. email, sms)">
          <UInput v-model="channelsInput" class="w-full" />
        </UFormField>

        <UFormField label="Recipients" help="Comma separated email addresses or phone numbers">
          <UInput v-model="recipientsInput" class="w-full" />
        </UFormField>

        <UFormField label="Condition Settings (JSON)">
          <UTextarea 
            :model-value="JSON.stringify(state.condition_settings, null, 2)"
            @update:model-value="(val) => { try { state.condition_settings = JSON.parse(val) } catch {} }"
            :rows="5" 
            class="font-mono text-sm w-full"
          />
        </UFormField>

        <div class="flex items-center gap-2">
          <UCheckbox v-model="state.is_active" label="Active" />
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <UButton color="neutral" variant="subtle" @click="open = false">Cancel</UButton>
          <UButton color="primary" @click="onSave">Save</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
