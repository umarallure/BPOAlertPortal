<script setup lang="ts">
type AssetItem = {
  name: string
  url: string
  ext: string
}

const BUCKET = 'BPOAlertPortal'
const FOLDER = 'underwriting-instructions/videos'
const SIGNED_URL_TTL_SECONDS = 60 * 60

const supabase = useSupabaseClient()

const selectedVideo = ref<AssetItem | null>(null)
const items = ref<AssetItem[]>([])
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const error = ref<Error | null>(null)

const loadAssets = async () => {
  console.groupCollapsed('[Onboarding][Underwriting] loadAssets')
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

    return true
  })
  console.log('onlyFiles:', onlyFiles.map(f => f.name))

  const resolved = await Promise.all(
    onlyFiles.map(async (f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      const path = `${FOLDER}/${f.name}`

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

      return {
        name: f.name,
        url: signed.signedUrl,
        ext
      } satisfies AssetItem
    })
  )

  items.value = resolved.filter((x): x is AssetItem => Boolean(x))
  status.value = 'success'
  console.log('items resolved count:', items.value.length)
  console.groupEnd()
}

const refresh = async () => {
  await loadAssets()
}

onMounted(() => {
  loadAssets()
})

watchEffect(() => {
  if (!selectedVideo.value && items.value.length) {
    selectedVideo.value = items.value[0] ?? null
  }
})
</script>

<template>
  <UDashboardPanel id="on-boarding-guide-underwriting">
    <template #header>
      <UDashboardNavbar title="On Boarding Guide">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard :ui="{ body: 'p-0' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-highlighted">Underwriting Instructions</h2>
                <p class="text-sm text-muted">Drop videos into <span class="font-mono">BPOAlertPortal/underwriting-instructions/videos</span>.</p>
              </div>
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

          <div class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
            <div class="lg:col-span-1">
              <div class="text-sm font-medium text-highlighted mb-2">Playlist</div>

              <UCard :ui="{ body: 'p-0' }">
                <div v-if="status === 'pending'" class="p-4 text-sm text-muted">Loading videos...</div>
                <div v-else-if="status === 'error'" class="p-4 text-sm text-muted">{{ error?.message || 'Error loading videos.' }}</div>
                <div v-else-if="!items.length" class="p-4 text-sm text-muted">No videos found.</div>
                <div v-else class="divide-y divide-default">
                  <button
                    v-for="video in items"
                    :key="video.url"
                    type="button"
                    class="w-full text-left px-4 py-3 hover:bg-elevated/50"
                    :class="selectedVideo?.url === video.url ? 'bg-elevated/50' : ''"
                    @click="selectedVideo = video"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-sm font-medium text-highlighted truncate">{{ video.name }}</div>
                        <div class="text-xs text-muted">{{ video.ext.toUpperCase() }}</div>
                      </div>
                      <UIcon name="i-lucide-play" class="size-4 shrink-0 text-muted" />
                    </div>
                  </button>
                </div>
              </UCard>
            </div>

            <div class="lg:col-span-2">
              <div class="text-sm font-medium text-highlighted mb-2">Player</div>

              <UCard>
                <div v-if="!selectedVideo" class="text-sm text-muted">Select a video from the playlist.</div>
                <video
                  v-else
                  class="w-full rounded-md bg-black"
                  controls
                  :src="selectedVideo.url"
                />
              </UCard>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
