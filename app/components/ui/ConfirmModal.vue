<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: 'primary' | 'neutral' | 'error' | 'success' | 'warning'
  loading?: boolean
}>(), {
  title: 'Confirm',
  description: 'Are you sure you want to continue?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: 'error',
  loading: false
})

const emit = defineEmits<(e: 'confirm' | 'cancel') => void>()

const open = defineModel<boolean>('open')

const onCancel = () => {
  emit('cancel')
  open.value = false
}

const onConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #body>
      <div class="flex justify-end gap-2">
        <UButton
          :label="cancelText"
          color="neutral"
          variant="subtle"
          :disabled="loading"
          @click="onCancel"
        />
        <UButton
          :label="confirmText"
          :color="confirmColor"
          variant="solid"
          :loading="loading"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
