<script setup lang="ts">
const props = withDefaults(defineProps<{
  bucket: string
  folder: string
  accept?: string
}>(), {
  accept: ''
})

const emit = defineEmits<{
  (e: 'uploaded'): void
}>()

const open = defineModel<boolean>('open')

const supabase = useSupabaseClient()
const toast = useToast()

const title = ref('')
const description = ref('')
const file = ref<File | null>(null)
const uploading = ref(false)

const inputEl = ref<HTMLInputElement | null>(null)

const MAX_BYTES = 50 * 1024 * 1024

const canSubmit = computed(() => Boolean(title.value.trim()) && Boolean(file.value) && !uploading.value)

function reset() {
  title.value = ''
  description.value = ''
  file.value = null
}

watch(open, (isOpen) => {
  if (!isOpen) {
    reset()
  }
})

function pickFile() {
  inputEl.value?.click()
}

function onFileSelected(f: File | null) {
  if (!f) {
    file.value = null
    return
  }

  if (f.size > MAX_BYTES) {
    toast.add({
      title: 'File too large',
      description: 'Max file size is 50MB.',
      color: 'error'
    })
    file.value = null
    return
  }

  file.value = f
}

function safeBaseName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 80)
}

async function upload() {
  if (!file.value) {
    return
  }

  const base = safeBaseName(title.value) || 'asset'
  const ext = file.value.name.split('.').pop() || ''
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const objectName = ext ? `${base}-${stamp}.${ext}` : `${base}-${stamp}`
  const path = `${props.folder}/${objectName}`

  uploading.value = true
  try {
    const { error: uploadError } = await supabase
      .storage
      .from(props.bucket)
      .upload(path, file.value, { upsert: true, contentType: file.value.type || undefined })

    if (uploadError) {
      throw uploadError
    }

    const meta = {
      title: title.value.trim(),
      description: description.value.trim(),
      original_name: file.value.name,
      uploaded_at: new Date().toISOString(),
      path
    }

    const metaPath = `${props.folder}/${objectName}.meta.json`
    const metaBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })

    const { error: metaError } = await supabase
      .storage
      .from(props.bucket)
      .upload(metaPath, metaBlob, { upsert: true, contentType: 'application/json' })

    if (metaError) {
      throw metaError
    }

    toast.add({
      title: 'Uploaded',
      description: 'File uploaded successfully.',
      color: 'success'
    })

    emit('uploaded')
    open.value = false
  } catch (e: any) {
    toast.add({
      title: 'Upload failed',
      description: e?.message || 'Unable to upload file.',
      color: 'error'
    })
  } finally {
    uploading.value = false
  }
}

function onDrop(evt: DragEvent) {
  evt.preventDefault()
  const dropped = evt.dataTransfer?.files?.[0] || null
  onFileSelected(dropped)
}
</script>

<template>
  <UModal v-model:open="open" title="Upload" description="Add title/description and upload a file (max 50MB).">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Title" required>
          <UInput v-model="title" class="w-full" placeholder="Enter title" />
        </UFormField>

        <UFormField label="Description">
          <UTextarea v-model="description" :rows="3" class="w-full" placeholder="Enter description" />
        </UFormField>

        <input
          ref="inputEl"
          type="file"
          class="hidden"
          :accept="accept"
          @change="(e) => onFileSelected((e.target as HTMLInputElement).files?.[0] || null)"
        >

        <div
          class="rounded-md border border-dashed border-default p-4 text-sm text-muted bg-elevated/25"
          @dragover.prevent
          @drop="onDrop"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-medium text-highlighted">Drag & drop file here</div>
              <div class="text-xs text-muted">Up to 50MB. Or click Select file.</div>
              <div v-if="file" class="mt-2 text-xs text-highlighted truncate">
                Selected: {{ file.name }} ({{ (file.size / (1024 * 1024)).toFixed(2) }}MB)
              </div>
            </div>
            <UButton
              label="Select file"
              icon="i-lucide-upload"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="uploading"
              @click="pickFile"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="subtle" :disabled="uploading" @click="open = false">Cancel</UButton>
          <UButton color="primary" :loading="uploading" :disabled="!canSubmit" @click="upload">Upload</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
