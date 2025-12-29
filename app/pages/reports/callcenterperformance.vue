<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { DateFormatter } from '@internationalized/date'
import { subDays } from 'date-fns'
import type { Range } from '~/types'
import HomeDateRangePicker from '~/components/home/HomeDateRangePicker.vue'
import { calculatePercentageChange, formatDateEST } from '~/utils'
import { downloadCallCenterPerformanceReportPdf } from '~/utils/reportExport'
import { fetchByContiguousRanges } from '~/utils/supabaseWorkingDayQuery'
import { getPreviousBusinessDatesForComparison, getWorkingDatesBetween } from '~/utils/workingDays'

type CallCenterMetricRow = {
  metric: string
  thisWeek: number
  lastWeek: number
  deltaPercent: string
}

type CallCenterReport = {
  id: string
  leadVendor: string
  centerName: string
  isActive: boolean
  metrics: CallCenterMetricRow[]
}

type CenterThresholdLite = {
  id: string
  center_name: string
  lead_vendor: string | null
  is_active: boolean
}

type DealFlowLite = {
  lead_vendor: string | null
  status: string | null
  call_result: string | null
}

type VendorAggregate = {
  transfers: number
  pending: number
  underwriting: number
  dq: number
  callbacks: number
}

type CallCenterComputed = {
  callCenters: CallCenterReport[]
}

type CallCenterFeedbackRow = {
  id: string
  center_id: string
  title: string
  description: string
  feedback_by: string
  created_at: string
}

const dqStatuses = [
  'Returned To Center - DQ',
  'DQ\'d Can\'t be sold',
  'GI - Currently DQ'
]

const supabase = useSupabaseClient()
const toast = useToast()

const range = ref<Range>({
  start: subDays(new Date(), 4),
  end: new Date()
})

const weekLabelFormatter = new DateFormatter('en-US', {
  dateStyle: 'medium',
  timeZone: 'America/New_York'
})

const weekLabel = computed(() => {
  return `Week: ${weekLabelFormatter.format(range.value.start)} - ${weekLabelFormatter.format(range.value.end)}`
})

const isFeedbackModalOpen = ref(false)
const feedbackSaving = ref(false)
const feedbackCenter = ref<Pick<CallCenterReport, 'id' | 'centerName'> | null>(null)
const feedbackTitle = ref('')
const feedbackDescription = ref('')

const feedbackTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: 'UTC'
})

const formatFeedbackTimestamp = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${feedbackTimestampFormatter.format(d)} UTC`
}

const feedbackByCenterId = ref<Record<string, CallCenterFeedbackRow[]>>({})

const openFeedbackModal = (center: CallCenterReport) => {
  feedbackCenter.value = { id: center.id, centerName: center.centerName }
  feedbackTitle.value = ''
  feedbackDescription.value = ''
  isFeedbackModalOpen.value = true
}

const loadFeedbacks = async (centerIds: string[]) => {
  if (centerIds.length === 0) {
    feedbackByCenterId.value = {}
    return
  }

  const dateFrom = formatDateEST(range.value.start)
  const dateTo = formatDateEST(range.value.end)

  const { data, error } = await supabase
    .from('call_center_feedback')
    .select('id,center_id,title,description,feedback_by,created_at')
    .in('center_id', centerIds)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59.999`)
    .order('created_at', { ascending: false })

  if (error) {
    toast.add({ title: 'Error loading feedback', description: error.message, color: 'error' })
    return
  }

  const grouped: Record<string, CallCenterFeedbackRow[]> = {}
  for (const row of (data || []) as CallCenterFeedbackRow[]) {
    const key = row.center_id
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(row)
  }

  feedbackByCenterId.value = grouped
}

const saveFeedback = async () => {
  if (!feedbackCenter.value) return
  if (!feedbackTitle.value.trim() || !feedbackDescription.value.trim()) {
    toast.add({ title: 'Missing fields', description: 'Please enter both a title and description.', color: 'error' })
    return
  }

  feedbackSaving.value = true

  const { error } = await supabase
    .from('call_center_feedback')
    .insert({
      center_id: feedbackCenter.value.id,
      title: feedbackTitle.value.trim(),
      description: feedbackDescription.value.trim(),
      feedback_by: 'admin'
    })

  if (error) {
    toast.add({ title: 'Error saving feedback', description: error.message, color: 'error' })
    feedbackSaving.value = false
    return
  }

  toast.add({ title: 'Feedback added', color: 'success' })
  isFeedbackModalOpen.value = false
  feedbackSaving.value = false
  await loadFeedbacks(displayedCallCenters.value.map(c => c.id))
}

const exportCallCenterReport = async () => {
  const dateFrom = formatDateEST(range.value.start)
  const dateTo = formatDateEST(range.value.end)

  await downloadCallCenterPerformanceReportPdf({
    filename: `weekly-call-center-performance-report_${dateFrom}_${dateTo}.pdf`,
    weekLabel: weekLabel.value,
    centers: displayedCallCenters.value.map(c => ({
      id: c.id,
      centerName: c.centerName,
      metrics: c.metrics.map(m => ({
        metric: m.metric,
        thisWeek: m.thisWeek,
        lastWeek: m.lastWeek,
        deltaPercent: m.deltaPercent
      })),
      feedbacks: (feedbackByCenterId.value[c.id] || []).map(fb => ({
        feedbackBy: fb.feedback_by,
        title: fb.title,
        description: fb.description,
        createdAt: fb.created_at
      }))
    }))
  })
}

const fetchDealFlowLiteByWorkingDates = async (dates: Date[]) => {
  const { data, error } = await fetchByContiguousRanges<DealFlowLite>(
    dates,
    async (r) => {
      const { data, count, error } = await supabase
        .from('daily_deal_flow')
        .select('lead_vendor,status,call_result', { count: 'exact' })
        .gte('date', r.dateFrom)
        .lte('date', r.dateTo)
        .range(0, 99999)

      return {
        data: (data || []) as DealFlowLite[],
        error,
        count
      }
    },
    { pageSize: 100000 }
  )

  return {
    data: (data || []) as DealFlowLite[],
    count: data?.length || 0,
    error
  }
}

const { data: centersData, status: centersStatus, refresh: refreshCenters } = await useAsyncData<CallCenterComputed>(
  'reports-callcenterperformance',
  async () => {
    try {
      const currentBusinessDates = getWorkingDatesBetween(range.value.start, range.value.end, {
        excludeSaturday: true
      })
      const previousBusinessDates = getPreviousBusinessDatesForComparison(currentBusinessDates, {
        excludeSaturday: true
      })

      const [{ data: currentData, error: currentError }, { data: previousData, error: previousError }] = await Promise.all([
        fetchDealFlowLiteByWorkingDates(currentBusinessDates),
        fetchDealFlowLiteByWorkingDates(previousBusinessDates)
      ])

      if (currentError) {
        throw currentError
      }

      if (previousError) {
        throw previousError
      }

      const groupByVendor = (data: DealFlowLite[]) => {
        const map = new Map<string, VendorAggregate>()
        for (const row of data) {
          const vendor = row.lead_vendor || 'Unknown'
          const current = map.get(vendor) || { transfers: 0, pending: 0, underwriting: 0, dq: 0, callbacks: 0 }
          current.transfers += 1
          if (row.status === 'Pending Approval') {
            current.pending += 1
          }
          if (row.call_result === 'Underwriting') {
            current.underwriting += 1
          }
          if (dqStatuses.includes(row.status || '')) {
            current.dq += 1
          }
          if (row.status === 'Needs BPO Callback' || row.status === 'Incomplete Transfer') {
            current.callbacks += 1
          }
          map.set(vendor, current)
        }
        return map
      }

      const currentByVendor = groupByVendor(currentData)
      const previousByVendor = groupByVendor(previousData)

      const { data: thresholds, error: thresholdsError } = await supabase
        .from('center_thresholds')
        .select('id,center_name,lead_vendor,is_active')
        .order('center_name', { ascending: true })

      let centers = (thresholds || []) as CenterThresholdLite[]

      if (thresholdsError || centers.length === 0) {
        const vendors = Array.from(
          new Set(
            [...currentData, ...previousData]
              .map(r => r.lead_vendor)
              .filter((v): v is string => Boolean(v && v.trim()))
          )
        ).sort((a, b) => a.localeCompare(b))

        centers = vendors.map(v => ({
          id: v,
          center_name: v,
          lead_vendor: v,
          is_active: true
        }))
      }

      const callCenters: CallCenterReport[] = centers.map((c) => {
        const leadVendor = c.lead_vendor || ''
        const current = leadVendor ? (currentByVendor.get(leadVendor) || { transfers: 0, pending: 0, underwriting: 0, dq: 0, callbacks: 0 }) : { transfers: 0, pending: 0, underwriting: 0, dq: 0, callbacks: 0 }
        const previous = leadVendor ? (previousByVendor.get(leadVendor) || { transfers: 0, pending: 0, underwriting: 0, dq: 0, callbacks: 0 }) : { transfers: 0, pending: 0, underwriting: 0, dq: 0, callbacks: 0 }

        const currentApproved = Math.max(current.pending - current.underwriting, 0)
        const previousApproved = Math.max(previous.pending - previous.underwriting, 0)

        const metrics: CallCenterMetricRow[] = [{
          metric: 'Transfers',
          thisWeek: current.transfers,
          lastWeek: previous.transfers,
          deltaPercent: `${current.transfers >= previous.transfers ? '+' : ''}${calculatePercentageChange(current.transfers, previous.transfers)}%`
        }, {
          metric: 'Sales',
          thisWeek: currentApproved,
          lastWeek: previousApproved,
          deltaPercent: `${currentApproved >= previousApproved ? '+' : ''}${calculatePercentageChange(currentApproved, previousApproved)}%`
        }, {
          metric: 'Underwriting',
          thisWeek: current.underwriting,
          lastWeek: previous.underwriting,
          deltaPercent: `${current.underwriting >= previous.underwriting ? '+' : ''}${calculatePercentageChange(current.underwriting, previous.underwriting)}%`
        }, {
          metric: 'DQ / GI',
          thisWeek: current.dq,
          lastWeek: previous.dq,
          deltaPercent: `${current.dq >= previous.dq ? '+' : ''}${calculatePercentageChange(current.dq, previous.dq)}%`
        }]

        return {
          id: c.id,
          leadVendor,
          centerName: c.center_name,
          isActive: c.is_active,
          metrics
        }
      })

      return { callCenters }
    } catch (e: any) {
      toast.add({ title: 'Error loading report', description: e?.message || 'Failed to load call center report data.', color: 'error' })
      return { callCenters: [] }
    }
  },
  {}
)

const selectedCallCenter = ref<string>('all')

const callCenterOptions = computed(() => {
  const items = centersData.value?.callCenters || []
  return [
    { label: 'All Call Centers', value: 'all' },
    ...items.map(c => ({ label: c.isActive ? c.centerName : `${c.centerName} (Inactive)`, value: c.id }))
  ]
})

const displayedCallCenters = computed(() => {
  const items = centersData.value?.callCenters || []
  if (selectedCallCenter.value === 'all') {
    return items
  }
  return items.filter(c => c.id === selectedCallCenter.value)
})

const displayedCenterIdsKey = computed(() => displayedCallCenters.value.map(c => c.id).sort().join(','))
const feedbackLoadKey = computed(() => `${displayedCenterIdsKey.value}|${formatDateEST(range.value.start)}-${formatDateEST(range.value.end)}`)
watch(feedbackLoadKey, async () => {
  await loadFeedbacks(displayedCallCenters.value.map(c => c.id))
}, { immediate: true })

const rangeKey = computed(() => `${formatDateEST(range.value.start)}-${formatDateEST(range.value.end)}`)
let refreshTimeout: ReturnType<typeof setTimeout> | undefined
watch(rangeKey, () => {
  if (refreshTimeout) clearTimeout(refreshTimeout)
  refreshTimeout = setTimeout(() => {
    refreshCenters()
  }, 300)
})

const callCenterMetricsColumns: TableColumn<CallCenterMetricRow>[] = [{
  accessorKey: 'metric',
  header: 'Metric'
}, {
  accessorKey: 'thisWeek',
  header: 'This Week'
}, {
  accessorKey: 'lastWeek',
  header: 'Last Week'
}, {
  accessorKey: 'deltaPercent',
  header: 'Δ %'
}]
</script>

<template>
  <UDashboardPanel id="reports-call-centers">
    <template #header>
      <UDashboardNavbar title="Reports" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <HomeDateRangePicker v-model="range" class="-ms-1" />

          <USelectMenu
            v-model="selectedCallCenter"
            :items="callCenterOptions"
            value-key="value"
            label-key="label"
            size="xs"
            class="w-64"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UPageCard variant="subtle">
          <template #title>
            <div class="flex w-full items-center justify-between gap-3">
              <span class="min-w-0">Weekly Call Center Performance Report</span>
              <div class="flex shrink-0 items-center">
                <UButton
                  variant="outline"
                  size="xs"
                  icon="i-lucide-download"
                  @click.stop="exportCallCenterReport"
                >
                  Export
                </UButton>
              </div>
            </div>
          </template>

          <template #description>
            {{ weekLabel }}
          </template>
        </UPageCard>

        <div class="grid gap-6">
          <UPageCard
            v-for="center in displayedCallCenters"
            :key="center.id"
            variant="subtle"
          >
            <template #title>
              <div class="flex w-full items-center justify-between gap-3">
                <span class="min-w-0">{{ center.centerName }}</span>
                <div class="flex shrink-0 items-center">
                  <UButton
                    variant="outline"
                    size="xs"
                    icon="i-lucide-message-square"
                    @click.stop="openFeedbackModal(center)"
                  >
                    Add Feedback
                  </UButton>
                </div>
              </div>
            </template>

            <UTable
              :data="center.metrics"
              :columns="callCenterMetricsColumns"
              :loading="centersStatus === 'pending'"
              :ui="{ thead: '[&>tr]:bg-elevated/50' }"
            />

            <div
              v-if="(feedbackByCenterId[center.id] || []).length"
              class="mt-4 space-y-3"
            >
              <div class="text-sm font-medium">Feedback</div>

              <div
                v-for="fb in feedbackByCenterId[center.id]"
                :key="fb.id"
                class="rounded-md border border-gray-200 dark:border-gray-800 p-3"
              >
                <div class="text-xs text-gray-500">Feedback by: {{ fb.feedback_by || 'admin' }}</div>
                <div class="mt-1 text-sm font-semibold">{{ fb.title }}</div>
                <div class="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{{ fb.description }}</div>
                <div class="mt-2 text-xs text-gray-500">{{ formatFeedbackTimestamp(fb.created_at) }}</div>
              </div>
            </div>
          </UPageCard>
        </div>
      </div>

      <UModal
        v-model:open="isFeedbackModalOpen"
        :title="feedbackCenter ? `Add Feedback - ${feedbackCenter.centerName}` : 'Add Feedback'"
        description="Add feedback for this call center"
      >
        <template #body>
          <div class="space-y-4">
            <UFormField label="Title">
              <UInput v-model="feedbackTitle" class="w-full" placeholder="Feedback title" />
            </UFormField>

            <UFormField label="Description">
              <UTextarea v-model="feedbackDescription" :rows="4" class="w-full" placeholder="Feedback details" />
            </UFormField>

            <div class="flex justify-end gap-2 mt-4">
              <UButton color="neutral" variant="subtle" :disabled="feedbackSaving" @click="isFeedbackModalOpen = false">Cancel</UButton>
              <UButton color="primary" :loading="feedbackSaving" @click="saveFeedback">Save</UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
