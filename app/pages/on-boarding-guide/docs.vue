<script setup lang="ts">
type AssetItem = {
  name: string
  url: string
  ext: string
}

const BUCKET = 'BPOAlertPortal'
const FOLDER = 'docs/files'
const SIGNED_URL_TTL_SECONDS = 60 * 60

const supabase = useSupabaseClient()

const selectedDoc = ref<AssetItem | null>(null)
const items = ref<AssetItem[]>([])
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const error = ref<Error | null>(null)

const loadAssets = async () => {
  console.groupCollapsed('[Onboarding][Docs] loadAssets')
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
  if (!selectedDoc.value && items.value.length) {
    selectedDoc.value = items.value[0] ?? null
  }
})

function isPdf(item: AssetItem) {
  return item.ext === 'pdf'
}

function isOfficeDoc(item: AssetItem) {
  return ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(item.ext)
}

function officeViewerUrl(srcUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(srcUrl)}`
}
</script>

<template>
  <UDashboardPanel id="on-boarding-guide-docs">
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
                <h2 class="text-base font-semibold text-highlighted">Docs</h2>
                <p class="text-sm text-muted">Drop docs into <span class="font-mono">BPOAlertPortal/docs/files</span> (PDF/images).</p>
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
              <div class="text-sm font-medium text-highlighted mb-2">Documents</div>

              <UCard :ui="{ body: 'p-0' }">
                <div v-if="status === 'pending'" class="p-4 text-sm text-muted">Loading docs...</div>
                <div v-else-if="status === 'error'" class="p-4 text-sm text-muted">{{ error?.message || 'Error loading docs.' }}</div>
                <div v-else-if="!items.length" class="p-4 text-sm text-muted">No docs found.</div>
                <div v-else class="divide-y divide-default">
                  <button
                    v-for="doc in items"
                    :key="doc.url"
                    type="button"
                    class="w-full text-left px-4 py-3 hover:bg-elevated/50"
                    :class="selectedDoc?.url === doc.url ? 'bg-elevated/50' : ''"
                    @click="selectedDoc = doc"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-sm font-medium text-highlighted truncate">{{ doc.name }}</div>
                        <div class="text-xs text-muted">{{ doc.ext.toUpperCase() }}</div>
                      </div>
                      <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" />
                    </div>
                  </button>
                </div>
              </UCard>
            </div>

            <div class="lg:col-span-2">
              <div class="text-sm font-medium text-highlighted mb-2">Preview</div>

              <UCard>
                <div v-if="!selectedDoc" class="text-sm text-muted">Select a document from the list.</div>

                <iframe
                  v-else-if="isPdf(selectedDoc)"
                  class="w-full rounded-md border border-default bg-white"
                  style="height: 70vh"
                  :src="selectedDoc.url"
                />

                <iframe
                  v-else-if="isOfficeDoc(selectedDoc)"
                  class="w-full rounded-md border border-default bg-white"
                  style="height: 70vh"
                  :src="officeViewerUrl(selectedDoc.url)"
                />

                <img
                  v-else
                  class="w-full rounded-md border border-default"
                  :src="selectedDoc.url"
                  :alt="selectedDoc.name"
                >

                <div v-if="selectedDoc" class="flex justify-end pt-3">
                  <UButton
                    label="Open in new tab"
                    icon="i-lucide-external-link"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    :to="selectedDoc.url"
                    target="_blank"
                  />
                </div>
              </UCard>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
