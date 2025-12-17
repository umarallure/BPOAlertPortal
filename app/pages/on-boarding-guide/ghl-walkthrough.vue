<script setup lang="ts">
import AssetUploadModal from '~/components/onboarding/AssetUploadModal.vue'
import ConfirmModal from '~/components/ui/ConfirmModal.vue'

type AssetItem = {
  name: string
  url: string
  ext: string
  title?: string
  description?: string
}

const BUCKET = 'BPOAlertPortal'
const FOLDER = 'ghl-walkthrough/videos'
const SIGNED_URL_TTL_SECONDS = 60 * 60

const supabase = useSupabaseClient()
const toast = useToast()

const { role, refresh: refreshRole } = useAccessRole()
const isAdmin = computed(() => role.value === 'admin')
const isUploadOpen = ref(false)
const isDeleteOpen = ref(false)
const deleteTarget = ref<AssetItem | null>(null)
const deleting = ref(false)

const selectedVideo = ref<AssetItem | null>(null)
const items = ref<AssetItem[]>([])
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const error = ref<Error | null>(null)

const fetchMeta = async (signedMetaUrl: string) => {
  try {
    const res = await fetch(signedMetaUrl)
    if (!res.ok) {
      return null
    }
    const json = await res.json()
    return json as { title?: string, description?: string }
  } catch {
    return null
  }
}

const loadAssets = async () => {
  console.groupCollapsed('[Onboarding][GHL] loadAssets')
  console.log('BUCKET:', BUCKET)
  console.log('FOLDER:', FOLDER)
  console.log('SIGNED_URL_TTL_SECONDS:', SIGNED_URL_TTL_SECONDS)
  status.value = 'pending'
  error.value = null

  const { data: files, error: listError } = await supabase
    .storage
    .from(BUCKET)
    .list(FOLDER, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  console.log('list() files:', files)
  console.log('list() error:', listError)

  if (listError) {
    status.value = 'error'
    error.value = listError
    items.value = []
    console.groupEnd()
    return
  }

  const onlyFiles = (files || []).filter((f) => {
    if (!f?.name) {
      return false
    }

    if (f.name === '.emptyFolderPlaceholder') {
      return false
    }

    if (f.name.endsWith('/')) {
      return false
    }

    if (f.name.endsWith('.meta.json')) {
      return false
    }

    return true
  })
  console.log('onlyFiles:', onlyFiles.map(f => f.name))

  const resolved = await Promise.all(
    onlyFiles.map(async (f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      const path = `${FOLDER}/${f.name}`
      const metaPath = `${path}.meta.json`

      console.log('signing path:', path)

      const { data: signed, error: signedError } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

      if (signedError) {
        console.warn('createSignedUrl error:', { path, signedError })
      }

      if (signedError || !signed?.signedUrl) {
        return null
      }

      const { data: metaSigned } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrl(metaPath, SIGNED_URL_TTL_SECONDS)

      const meta = metaSigned?.signedUrl
        ? await fetchMeta(metaSigned.signedUrl)
        : null

      return {
        name: f.name,
        url: signed.signedUrl,
        ext,
        ...(meta?.title ? { title: meta.title } : {}),
        ...(meta?.description ? { description: meta.description } : {})
      } as AssetItem
    })
  )

  items.value = (resolved as Array<AssetItem | null>).filter((x): x is AssetItem => x !== null)
  status.value = 'success'
  console.log('items resolved count:', items.value.length)
  console.groupEnd()
}

const refresh = async () => {
  await loadAssets()
}

const askRemoveAsset = (item: AssetItem) => {
  if (!isAdmin.value) {
    return
  }
  deleteTarget.value = item
  isDeleteOpen.value = true
}

const confirmRemoveAsset = async () => {
  if (!isAdmin.value || !deleteTarget.value) {
    return
  }

  deleting.value = true
  try {
    const item = deleteTarget.value
    const assetPath = `${FOLDER}/${item.name}`
    const metaPath = `${assetPath}.meta.json`

    const { error: removeError } = await supabase
      .storage
      .from(BUCKET)
      .remove([assetPath, metaPath])

    if (removeError) {
      toast.add({ title: 'Delete failed', description: removeError.message, color: 'error' })
      return
    }

    if (selectedVideo.value?.name === item.name) {
      selectedVideo.value = null
    }

    toast.add({ title: 'Deleted', description: 'File deleted successfully.', color: 'success' })
    isDeleteOpen.value = false
    deleteTarget.value = null
    await refresh()
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  refreshRole()
  loadAssets()
})

watchEffect(() => {
  if (!selectedVideo.value && items.value.length) {
    selectedVideo.value = items.value[0] ?? null
  }
})
</script>

<template>
  <UDashboardPanel id="on-boarding-guide-ghl">
    <template #header>
      <UDashboardNavbar title="On Boarding Guide">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="h-[calc(100vh-6rem)] min-h-0 flex flex-col">
        <UCard :ui="{ body: 'p-0' }" class="flex-1 min-h-0">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-highlighted">GHL Walkthrough</h2>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  v-if="isAdmin"
                  label="Upload"
                  icon="i-lucide-upload"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="isUploadOpen = true"
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
            </div>
          </template>

          <AssetUploadModal
            v-model:open="isUploadOpen"
            :bucket="BUCKET"
            :folder="FOLDER"
            accept="video/*"
            @uploaded="refresh"
          />

          <ConfirmModal
            v-model:open="isDeleteOpen"
            title="Delete file"
            description="Are you sure you want to delete this file? This cannot be undone."
            confirm-text="Delete"
            cancel-text="Cancel"
            confirm-color="error"
            :loading="deleting"
            @confirm="confirmRemoveAsset"
            @cancel="() => { deleteTarget = null }"
          />

          <div class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3 h-full min-h-0">
            <div class="lg:col-span-1">
              <div class="text-sm font-medium text-highlighted mb-2">Playlist</div>

              <UCard :ui="{ body: 'p-0' }" class="h-full min-h-0">
                <div v-if="status === 'pending'" class="p-4 text-sm text-muted">Loading videos...</div>
                <div v-else-if="status === 'error'" class="p-4 text-sm text-muted">{{ error?.message || 'Error loading videos.' }}</div>
                <div v-else-if="!items.length" class="p-4 text-sm text-muted">No videos found.</div>
                <div v-else class="divide-y divide-default overflow-auto" style="max-height: calc(100vh - 14rem)">
                  <button
                    v-for="video in items"
                    :key="video.url"
                    type="button"
                    class="w-full text-left px-4 py-3 hover:bg-elevated/50"
                    :class="selectedVideo?.url === video.url ? 'bg-primary/10 ring-1 ring-primary/20' : ''"
                    @click="selectedVideo = video"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-sm font-medium text-highlighted truncate">{{ video.title || video.name }}</div>
                        <div class="text-xs text-muted truncate">{{ video.description || video.ext.toUpperCase() }}</div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <UButton
                          v-if="isAdmin"
                          icon="i-lucide-trash"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click.stop="askRemoveAsset(video)"
                        />
                        <UIcon name="i-lucide-play" class="size-4 text-muted" />
                      </div>
                    </div>
                  </button>
                </div>
              </UCard>
            </div>

            <div class="lg:col-span-2">
              <div class="text-sm font-medium text-highlighted mb-2">Player</div>

              <UCard class="h-full min-h-0">
                <div v-if="!selectedVideo" class="text-sm text-muted">Select a video from the playlist.</div>

                <div v-else class="h-full min-h-0 flex flex-col gap-3">
                  <video
                    class="w-full rounded-md bg-black"
                    style="flex: 1 1 auto; min-height: 0"
                    controls
                    :src="selectedVideo.url"
                  />

                  <div>
                    <div class="text-sm font-semibold text-highlighted">{{ selectedVideo.title || selectedVideo.name }}</div>
                    <div v-if="selectedVideo.description" class="text-sm text-muted mt-1">{{ selectedVideo.description }}</div>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
