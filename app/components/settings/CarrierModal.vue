<script setup lang="ts">
import type { CarrierThreshold } from '~/types'

const props = defineProps<{
  carrier?: CarrierThreshold | null
}>()

const emit = defineEmits(['save', 'update:open'])

const open = defineModel<boolean>('open')

const state = ref<Partial<CarrierThreshold>>({
  carrier_name: '',
  underwriting_threshold: 0,
  is_active: true
})

watch(() => props.carrier, (newCarrier) => {
  if (newCarrier) {
    state.value = { ...newCarrier }
  } else {
    state.value = {
      carrier_name: '',
      underwriting_threshold: 0,
      is_active: true
    }
  }
}, { immediate: true })

const onSave = () => {
  emit('save', state.value)
}
</script>

<template>
  <UModal v-model:open="open" :title="carrier ? 'Edit Carrier' : 'New Carrier'" :description="carrier ? `Edit ${carrier.carrier_name}` : 'Add a new carrier threshold'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Carrier Name">
          <UInput v-model="state.carrier_name" class="w-full" />
        </UFormField>

        <UFormField label="Underwriting Threshold">
          <UInput type="number" v-model="state.underwriting_threshold" class="w-full" />
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
