<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { upperFirst } from 'scule'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { DailyDealFlow, Range } from '~/types'
import HomeDateRangePicker from '~/components/home/HomeDateRangePicker.vue'
import { DateFormatter } from '@internationalized/date'

const dateFormatter = new DateFormatter('en-CA', {
  dateStyle: 'short',
  timeZone: 'America/New_York'
})

const formatDateEST = (date: Date): string => {
  return dateFormatter.format(date)
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const table = useTemplateRef('table')
const router = useRouter()
const supabase = useSupabaseClient()

const columnFilters = ref([{
  id: 'insured_name',
  value: ''
}])
const columnVisibility = ref()
const rowSelection = ref({})

// Use composable directly to fetch data with authentication
const { fetchAll } = useDailyDealFlow()
const data = ref<DailyDealFlow[]>([])
const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const totalCount = ref(0)
const currentPage = ref(0)
const pageSize = ref(100)

const loadData = async (page = 0) => {
  status.value = 'pending'
  
  // Build filter object
  const filterObj: any = {
    limit: pageSize.value,
    offset: page * pageSize.value
  }
  
  if (statusFilter.value !== 'all') filterObj.status = statusFilter.value
  if (agentFilter.value !== 'all') filterObj.agent = agentFilter.value
  if (carrierFilter.value !== 'all') filterObj.carrier = carrierFilter.value
  if (callResultFilter.value !== 'all') filterObj.callResult = callResultFilter.value
  if (leadVendorFilter.value !== 'all') filterObj.leadVendor = leadVendorFilter.value
  if (insuredName.value) filterObj.insuredName = insuredName.value
  
  // Handle date filters
  if (dateRange.value.start && dateRange.value.end) {
    filterObj.dateFrom = formatDateEST(dateRange.value.start)
    filterObj.dateTo = formatDateEST(dateRange.value.end)
  }
  
  console.log('Fetching page:', page, 'with filters:', filterObj)
  const { data: result, error, count } = await fetchAll(filterObj)
  
  console.log('Fetch result:', {
    recordsReceived: result?.length,
    totalCount: count,
    error: error?.message
  })
  
  if (error) {
    console.error('Error fetching data:', error)
    status.value = 'error'
    toast.add({
      title: 'Error loading data',
      description: error.message,
      color: 'error'
    })
  } else {
    data.value = result || []
    totalCount.value = count || 0
    currentPage.value = page
    status.value = 'success'
    console.log(`✅ Loaded ${data.value.length} records (Page ${page + 1})`)
  }
}

const refresh = async () => {
  await loadData()
}

// Load data on mount
onMounted(() => {
  loadData()
})

function getRowItems(row: Row<DailyDealFlow>) {
  return [
    {
      type: 'label',
      label: 'Actions'
    },
    {
      label: 'Copy submission ID',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(row.original.submission_id)
        toast.add({
          title: 'Copied to clipboard',
          description: 'Submission ID copied to clipboard'
        })
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'View details',
      icon: 'i-lucide-list'
    },
    {
      label: 'Edit entry',
      icon: 'i-lucide-pencil'
    },
    {
      type: 'separator'
    },
    {
      label: 'Delete entry',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect() {
        toast.add({
          title: 'Entry deleted',
          description: 'The entry has been deleted.'
        })
      }
    }
  ]
}

const columns: TableColumn<DailyDealFlow>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Select row'
      })
  },
  {
    accessorKey: 'submission_id',
    header: 'Submission ID',
    cell: ({ row }) => {
      return h('span', { class: 'font-mono text-sm' }, row.original.submission_id)
    }
  },
  {
    accessorKey: 'insured_name',
    header: 'Insured Name',
    cell: ({ row }) => {
      return h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, row.original.insured_name || 'N/A'),
        h('p', { class: 'text-xs text-muted' }, row.original.client_phone_number || '')
      ])
    }
  },
  {
    accessorKey: 'agent',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Agent',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    }
  },
  {
    accessorKey: 'lead_vendor',
    header: 'Lead Vendor',
    cell: ({ row }) => row.original.lead_vendor || 'N/A'
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const color = {
        'Pending Approval': 'primary' as const,
        'DQ': 'error' as const,
        'Callback': 'warning' as const,
        'Approved': 'success' as const,
        'Rejected': 'error' as const
      }[row.original.status || 'Pending Approval'] || 'neutral' as const

      return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () =>
        row.original.status || 'N/A'
      )
    }
  },
  {
    accessorKey: 'call_result',
    header: 'Call Result',
    cell: ({ row }) => {
      const color = {
        'Submitted': 'success' as const,
        'Underwriting': 'primary' as const,
        'Not Qualified': 'error' as const,
        'Callback Scheduled': 'warning' as const,
        'Quality Issue': 'error' as const,
        'Failed Quality Check': 'error' as const
      }[row.original.call_result || ''] || 'neutral' as const

      return h(UBadge, { variant: 'outline', color, class: 'text-xs' }, () =>
        row.original.call_result || 'N/A'
      )
    }
  },
  {
    accessorKey: 'carrier',
    header: 'Carrier',
    cell: ({ row }) => row.original.carrier || 'N/A'
  },
  {
    accessorKey: 'product_type',
    header: 'Product Type',
    cell: ({ row }) => row.original.product_type || 'N/A'
  },
  {
    accessorKey: 'monthly_premium',
    header: 'Premium',
    cell: ({ row }) => {
      const premium = row.original.monthly_premium
      return h('span', { class: 'font-medium' }, 
        premium ? `$${premium.toFixed(2)}` : 'N/A'
      )
    }
  },
  {
    accessorKey: 'face_amount',
    header: 'Face Amount',
    cell: ({ row }) => {
      const amount = row.original.face_amount
      return h('span', { class: 'font-medium' }, 
        amount ? `$${amount.toLocaleString()}` : 'N/A'
      )
    }
  },
  {
    accessorKey: 'date',
    header: 'Date',
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true
      
      const rowDate = row.getValue(columnId) as string
      if (!rowDate) return false
      
      if (Array.isArray(filterValue)) {
        const [startDate, endDate] = filterValue
        return rowDate >= startDate && rowDate <= endDate
      }
      
      return rowDate === filterValue
    },
    cell: ({ row }) => {
      const date = row.original.date
      return date ? new Date(date).toLocaleDateString() : 'N/A'
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'text-right' },
        h(
          UDropdownMenu,
          {
            content: {
              align: 'end'
            },
            items: getRowItems(row)
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost',
              class: 'ml-auto'
            })
        )
      )
    }
  }
]

const statusFilter = ref('all')
const carrierFilter = ref('all')
const callResultFilter = ref('all')
const agentFilter = ref('all')
const dateRange = ref<Range>({
  start: new Date(),
  end: new Date()
})
const leadVendorFilter = ref('all')

// Watch filters and reload data from server when they change
watch(() => statusFilter.value, async () => {
  pagination.value.pageIndex = 0 // Reset to first page
  await loadData(0)
})

watch(() => carrierFilter.value, async () => {
  pagination.value.pageIndex = 0
  await loadData(0)
})

watch(() => callResultFilter.value, async () => {
  pagination.value.pageIndex = 0
  await loadData(0)
})

watch(() => agentFilter.value, async () => {
  pagination.value.pageIndex = 0
  await loadData(0)
})

watch(() => dateRange.value, async () => {
  pagination.value.pageIndex = 0
  await loadData(0)
}, { deep: true })

watch(() => leadVendorFilter.value, async () => {
  pagination.value.pageIndex = 0
  await loadData(0)
})

const insuredNameSearch = ref('')
const insuredName = computed({
  get: (): string => {
    return insuredNameSearch.value
  },
  set: (value: string) => {
    insuredNameSearch.value = value
  }
})

// Debounced search to avoid too many server requests
let searchTimeout: NodeJS.Timeout
watch(() => insuredNameSearch.value, async (newVal) => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    pagination.value.pageIndex = 0
    await loadData(0)
  }, 500) // Wait 500ms after user stops typing
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 100
})

// Watch for pagination changes to load new data from server
watch(() => pagination.value.pageIndex, async (newPage) => {
  const serverPage = Math.floor((newPage * pagination.value.pageSize) / pageSize.value)
  if (serverPage !== currentPage.value) {
    await loadData(serverPage)
  }
})
</script>

<template>
  <UDashboardPanel id="daily-deal-flow">
    <template #header>
      <UDashboardNavbar title="Daily Deal Flow">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Refresh"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            @click="refresh"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5 mb-4">
        <UInput
          v-model="insuredName"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Search by insured name..."
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            v-if="table?.tableApi?.getFilteredSelectedRowModel().rows.length"
            label="Delete Selected"
            color="error"
            variant="subtle"
            icon="i-lucide-trash"
          >
            <template #trailing>
              <UKbd>
                {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length }}
              </UKbd>
            </template>
          </UButton>

          <!-- Date Range Filter -->
          <HomeDateRangePicker v-model="dateRange" />

          <!-- Status Filter -->
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All Status', value: 'all' },
              { label: 'Pending Approval', value: 'Pending Approval' },
              { label: 'Needs BPO Callback', value: 'Needs BPO Callback' },
              { label: 'Returned To Center - DQ', value: 'Returned To Center - DQ' },
              { label: 'Incomplete Transfer', value: 'Incomplete Transfer' },
              { label: 'Pending Failed Payment Fix', value: 'Pending Failed Payment Fix' },
              { label: 'DQ\'d Can\'t be sold', value: 'DQ\'d Can\'t be sold' },
              { label: 'Application Withdrawn', value: 'Application Withdrawn' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter Status"
            class="min-w-36"
          />

          <!-- Call Result Filter -->
          <USelect
            v-model="callResultFilter"
            :items="[
              { label: 'All Results', value: 'all' },
              { label: 'Submitted', value: 'Submitted' },
              { label: 'Underwriting', value: 'Underwriting' },
              { label: 'Not Submitted', value: 'Not Submitted' },
              { label: 'Callback Scheduled', value: 'Callback Scheduled' },
              { label: 'Not Qualified', value: 'Not Qualified' },
              { label: 'Quality Issue', value: 'Quality Issue' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Call Result"
            class="min-w-36"
          />

          <!-- Carrier Filter -->
          <USelect
            v-model="carrierFilter"
            :items="[
              { label: 'All Carriers', value: 'all' },
              { label: 'Liberty', value: 'Liberty' },
              { label: 'SBLI', value: 'SBLI' },
              { label: 'Corebridge', value: 'Corebridge' },
              { label: 'MOH', value: 'MOH' },
              { label: 'Transamerica', value: 'Transamerica' },
              { label: 'RNA', value: 'RNA' },
              { label: 'AMAM', value: 'AMAM' },
              { label: 'GTL', value: 'GTL' },
              { label: 'Aetna', value: 'Aetna' },
              { label: 'Americo', value: 'Americo' },
              { label: 'CICA', value: 'CICA' },
              { label: 'N/A', value: 'N/A' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter Carrier"
            class="min-w-36"
          />

          <!-- Agent Filter -->
          <USelect
            v-model="agentFilter"
            :items="[
              { label: 'All Agents', value: 'all' },
              { label: 'Claudia', value: 'Claudia' },
              { label: 'Lydia', value: 'Lydia' },
              { label: 'Zack', value: 'Zack' },
              { label: 'Tatumn', value: 'Tatumn' },
              { label: 'Benjamin', value: 'Benjamin' },
              { label: 'Kaye', value: 'Kaye' },
              { label: 'Isaac', value: 'Isaac' },
              { label: 'Abdul', value: 'Abdul' },
              { label: 'Nicole Mejia', value: 'Nicole Mejia' },
              { label: 'Precy Lou', value: 'Precy Lou' },
              { label: 'Laiza Batain', value: 'Laiza Batain' },
              { label: 'N/A', value: 'N/A' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter Agent"
            class="min-w-36"
          />

          <!-- Lead Vendor Filter -->
          <USelect
            v-model="leadVendorFilter"
            :items="[
              { label: 'All Vendors', value: 'all' },
              { label: 'Ark Tech', value: 'Ark Tech' },
              { label: 'GrowthOnics BPO', value: 'GrowthOnics BPO' },
              { label: 'Maverick', value: 'Maverick' },
              { label: 'Omnitalk BPO', value: 'Omnitalk BPO' },
              { label: 'Vize BPO', value: 'Vize BPO' },
              { label: 'Corebiz', value: 'Corebiz' },
              { label: 'Digicon', value: 'Digicon' },
              { label: 'Ambition', value: 'Ambition' },
              { label: 'Benchmark', value: 'Benchmark' },
              { label: 'Poshenee', value: 'Poshenee' },
              { label: 'Plexi', value: 'Plexi' },
              { label: 'Gigabite', value: 'Gigabite' },
              { label: 'Everline solution', value: 'Everline solution' },
              { label: 'Progressive BPO', value: 'Progressive BPO' },
              { label: 'Cerberus BPO', value: 'Cerberus BPO' },
              { label: 'NanoTech', value: 'NanoTech' },
              { label: 'Optimum BPO', value: 'Optimum BPO' },
              { label: 'Ethos BPO', value: 'Ethos BPO' },
              { label: 'Trust Link', value: 'Trust Link' },
              { label: 'Crown Connect BPO', value: 'Crown Connect BPO' },
              { label: 'Quotes BPO', value: 'Quotes BPO' },
              { label: 'Zupax Marketing', value: 'Zupax Marketing' },
              { label: 'Argon Comm', value: 'Argon Comm' },
              { label: 'Care Solutions', value: 'Care Solutions' },
              { label: 'Cutting Edge', value: 'Cutting Edge' },
              { label: 'Next Era', value: 'Next Era' },
              { label: 'Rock BPO', value: 'Rock BPO' },
              { label: 'Avenue Consultancy', value: 'Avenue Consultancy' },
              { label: 'AJ BPO', value: 'AJ BPO' },
              { label: 'Pro Solutions BPO', value: 'Pro Solutions BPO' },
              { label: 'Emperor BPO', value: 'Emperor BPO' },
              { label: 'Networkize', value: 'Networkize' },
              { label: 'LightVerse BPO', value: 'LightVerse BPO' },
              { label: 'Leads BPO', value: 'Leads BPO' },
              { label: 'Helix BPO', value: 'Helix BPO' },
              { label: 'CrossNotch', value: 'CrossNotch' },
              { label: 'StratiX BPO', value: 'StratiX BPO' },
              { label: 'Exito BPO', value: 'Exito BPO' },
              { label: 'Lumenix BPO', value: 'Lumenix BPO' },
              { label: 'All-Star BPO', value: 'All-Star BPO' },
              { label: 'DownTown BPO', value: 'DownTown BPO' },
              { label: 'TechPlanet', value: 'TechPlanet' },
              { label: 'Livik BPO', value: 'Livik BPO' },
              { label: 'NexGen BPO', value: 'NexGen BPO' },
              { label: 'Quoted-Leads BPO', value: 'Quoted-Leads BPO' },
              { label: 'SellerZ BPO', value: 'SellerZ BPO' },
              { label: 'Venom BPO', value: 'Venom BPO' },
              { label: 'Core Marketing', value: 'Core Marketing' },
              { label: 'WinBPO', value: 'WinBPO' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter Vendor"
            class="min-w-36"
          />
          
          <UDropdownMenu
            :items="
              table?.tableApi
                ?.getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => ({
                  label: upperFirst(column.id.replace(/_/g, ' ')),
                  type: 'checkbox' as const,
                  checked: column.getIsVisible(),
                  onUpdateChecked(checked: boolean) {
                    table?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
                  },
                  onSelect(e?: Event) {
                    e?.preventDefault()
                  }
                }))
            "
            :content="{ align: 'end' }"
          >
            <UButton
              label="Columns"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-settings-2"
            />
          </UDropdownMenu>
        </div>
      </div>

      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel()
        }"
        class="shrink-0"
        :data="data"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      />

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="flex items-center gap-4">
          <div class="text-sm text-muted">
            <span class="font-medium">{{ totalCount.toLocaleString() }}</span> matching records
          </div>
          <div class="text-sm text-muted">
            <span class="font-medium">{{ data.length.toLocaleString() }}</span> on page {{ pagination.pageIndex + 1 }}
          </div>
          <div class="text-sm text-muted" v-if="table?.tableApi?.getFilteredSelectedRowModel().rows.length">
            <span class="font-medium">{{ table?.tableApi?.getFilteredSelectedRowModel().rows.length.toLocaleString() || 0 }}</span> selected
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="totalCount"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
