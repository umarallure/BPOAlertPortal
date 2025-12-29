<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { DateFormatter } from '@internationalized/date'
import { subDays } from 'date-fns'
import type { Range } from '~/types'
import HomeDateRangePicker from '~/components/home/HomeDateRangePicker.vue'
import { calculatePercentageChange, formatDateEST } from '~/utils'
import { downloadAgencyPerformanceReportPdf } from '~/utils/reportExport'
import { fetchByContiguousRanges } from '~/utils/supabaseWorkingDayQuery'
import { getPreviousBusinessDatesForComparison, getWorkingDatesBetween } from '~/utils/workingDays'

type ExecutiveSummaryRow = {
  metric: string
  thisWeek: number
  lastWeek: number
  deltaPercent: string
  notes: string
}

type PerformanceRateRow = {
  kpi: string
  rate: string
  formula: string
  interpretation: string
}

type TopPerformers = {
  highestTransfer: { name: string, value: string }
  highestSales: { name: string, value: string }
  mostImproved: { name: string, value: string }
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

type AgencyComputed = {
  executiveSummary: ExecutiveSummaryRow[]
  performanceRates: PerformanceRateRow[]
  topPerformers: TopPerformers
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

const agencyWeekLabel = computed(() => {
  return `Week: ${weekLabelFormatter.format(range.value.start)} - ${weekLabelFormatter.format(range.value.end)}`
})

const exportAgencyReport = async () => {
  const dateFrom = formatDateEST(range.value.start)
  const dateTo = formatDateEST(range.value.end)

  await downloadAgencyPerformanceReportPdf({
    filename: `weekly-agency-performance-report_${dateFrom}_${dateTo}.pdf`,
    weekLabel: agencyWeekLabel.value,
    executiveSummary: executiveSummaryData.value.map(r => ({
      metric: r.metric,
      thisWeek: r.thisWeek,
      lastWeek: r.lastWeek,
      deltaPercent: r.deltaPercent
    })),
    performanceRates: performanceRatesData.value.map(r => ({
      kpi: r.kpi,
      rate: r.rate,
      formula: r.formula,
      interpretation: r.interpretation
    })),
    topPerformers: topPerformers.value
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

const { data: agencyData, status: agencyStatus, refresh: refreshAgency } = await useAsyncData<AgencyComputed>(
  'reports-agencyperformance',
  async () => {
    try {
      const currentBusinessDates = getWorkingDatesBetween(range.value.start, range.value.end, {
        excludeSaturday: true
      })
      const previousBusinessDates = getPreviousBusinessDatesForComparison(currentBusinessDates, {
        excludeSaturday: true
      })

      const [{ data: currentData, count: currentCount, error: currentError }, { data: previousData, count: previousCount, error: previousError }] = await Promise.all([
        fetchDealFlowLiteByWorkingDates(currentBusinessDates),
        fetchDealFlowLiteByWorkingDates(previousBusinessDates)
      ])

      if (currentError) {
        throw currentError
      }

      if (previousError) {
        throw previousError
      }

      const totalTransfers = currentCount || 0
      const lastTotalTransfers = previousCount || 0

      const pendingApproval = currentData.filter(d => d.status === 'Pending Approval').length
      const lastPendingApproval = previousData.filter(d => d.status === 'Pending Approval').length

      const underwriting = currentData.filter(d => d.call_result === 'Underwriting').length
      const lastUnderwriting = previousData.filter(d => d.call_result === 'Underwriting').length

      const approved = Math.max(pendingApproval - underwriting, 0)
      const lastApproved = Math.max(lastPendingApproval - lastUnderwriting, 0)

      const dqCases = currentData.filter(d => dqStatuses.includes(d.status || '')).length
      const lastDqCases = previousData.filter(d => dqStatuses.includes(d.status || '')).length

      const nonPendingCount = totalTransfers - pendingApproval
      const lastNonPendingCount = lastTotalTransfers - lastPendingApproval

      const needsCallbackCount = currentData.filter(d => d.status === 'Needs BPO Callback' || d.status === 'Incomplete Transfer').length
      const lastNeedsCallbackCount = previousData.filter(d => d.status === 'Needs BPO Callback' || d.status === 'Incomplete Transfer').length

      const approvalRate = totalTransfers > 0 ? (pendingApproval / totalTransfers) * 100 : 0
      const callbackRate = nonPendingCount > 0 ? (needsCallbackCount / nonPendingCount) * 100 : 0
      const dqRate = nonPendingCount > 0 ? (dqCases / nonPendingCount) * 100 : 0
      const underwritingRate = pendingApproval > 0 ? (underwriting / pendingApproval) * 100 : 0

      const lastApprovalRate = lastTotalTransfers > 0 ? (lastPendingApproval / lastTotalTransfers) * 100 : 0
      const lastCallbackRate = lastNonPendingCount > 0 ? (lastNeedsCallbackCount / lastNonPendingCount) * 100 : 0
      const lastDqRate = lastNonPendingCount > 0 ? (lastDqCases / lastNonPendingCount) * 100 : 0
      const lastUnderwritingRate = lastPendingApproval > 0 ? (lastUnderwriting / lastPendingApproval) * 100 : 0

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

      let highestTransferVendor = { name: 'N/A', transfers: 0 }
      let highestSalesVendor = { name: 'N/A', approved: 0, transfers: 0 }
      let mostImprovedVendor = { name: 'N/A', improvement: -Infinity, currentTransfers: 0, previousTransfers: 0 }

      for (const [vendor, metrics] of currentByVendor.entries()) {
        if (metrics.transfers > highestTransferVendor.transfers) {
          highestTransferVendor = { name: vendor, transfers: metrics.transfers }
        }

        const approvedCount = Math.max(metrics.pending - metrics.underwriting, 0)
        if (approvedCount > highestSalesVendor.approved) {
          highestSalesVendor = { name: vendor, approved: approvedCount, transfers: metrics.transfers }
        }

        const previous = previousByVendor.get(vendor) || { transfers: 0, pending: 0, underwriting: 0, dq: 0, callbacks: 0 }
        const improvement = calculatePercentageChange(metrics.transfers, previous.transfers)
        if (improvement > mostImprovedVendor.improvement) {
          mostImprovedVendor = {
            name: vendor,
            improvement,
            currentTransfers: metrics.transfers,
            previousTransfers: previous.transfers
          }
        }
      }

      const topPerformers = {
        highestTransfer: {
          name: highestTransferVendor.name,
          value: highestTransferVendor.transfers.toLocaleString()
        },
        highestSales: {
          name: highestSalesVendor.name,
          value: `${highestSalesVendor.approved.toLocaleString()} (of ${highestSalesVendor.transfers.toLocaleString()} transfers)`
        },
        mostImproved: {
          name: mostImprovedVendor.name,
          value: `${mostImprovedVendor.improvement === -Infinity ? 0 : mostImprovedVendor.improvement}%`
        }
      }

      const executiveSummary: ExecutiveSummaryRow[] = [{
        metric: 'Total Transfers',
        thisWeek: totalTransfers,
        lastWeek: lastTotalTransfers,
        deltaPercent: `${totalTransfers >= lastTotalTransfers ? '+' : ''}${calculatePercentageChange(totalTransfers, lastTotalTransfers)}%`,
        notes: ''
      }, {
        metric: 'Total Sales (Approved)',
        thisWeek: approved,
        lastWeek: lastApproved,
        deltaPercent: `${approved >= lastApproved ? '+' : ''}${calculatePercentageChange(approved, lastApproved)}%`,
        notes: ''
      }, {
        metric: 'Pending Approval',
        thisWeek: pendingApproval,
        lastWeek: lastPendingApproval,
        deltaPercent: `${pendingApproval >= lastPendingApproval ? '+' : ''}${calculatePercentageChange(pendingApproval, lastPendingApproval)}%`,
        notes: ''
      }, {
        metric: 'Underwriting',
        thisWeek: underwriting,
        lastWeek: lastUnderwriting,
        deltaPercent: `${underwriting >= lastUnderwriting ? '+' : ''}${calculatePercentageChange(underwriting, lastUnderwriting)}%`,
        notes: ''
      }, {
        metric: 'DQ / GI Cases',
        thisWeek: dqCases,
        lastWeek: lastDqCases,
        deltaPercent: `${dqCases >= lastDqCases ? '+' : ''}${calculatePercentageChange(dqCases, lastDqCases)}%`,
        notes: ''
      }]

      const performanceRates: PerformanceRateRow[] = [{
        kpi: 'Approval Rate',
        rate: `${(Math.round(approvalRate * 10) / 10).toFixed(1)}%`,
        formula: `${pendingApproval} / ${totalTransfers}`,
        interpretation: `Prev: ${(Math.round(lastApprovalRate * 10) / 10).toFixed(1)}%`
      }, {
        kpi: 'Callback Rate',
        rate: `${(Math.round(callbackRate * 10) / 10).toFixed(1)}%`,
        formula: `${needsCallbackCount} / ${Math.max(nonPendingCount, 0)}`,
        interpretation: `Prev: ${(Math.round(lastCallbackRate * 10) / 10).toFixed(1)}%`
      }, {
        kpi: 'DQ Rate',
        rate: `${(Math.round(dqRate * 10) / 10).toFixed(1)}%`,
        formula: `${dqCases} / ${Math.max(nonPendingCount, 0)}`,
        interpretation: `Prev: ${(Math.round(lastDqRate * 10) / 10).toFixed(1)}%`
      }, {
        kpi: 'Underwriting Rate',
        rate: `${(Math.round(underwritingRate * 10) / 10).toFixed(1)}%`,
        formula: `${underwriting} / ${pendingApproval}`,
        interpretation: `Prev: ${(Math.round(lastUnderwritingRate * 10) / 10).toFixed(1)}%`
      }]

      return { executiveSummary, performanceRates, topPerformers }
    } catch (e: any) {
      toast.add({ title: 'Error loading report', description: e?.message || 'Failed to load agency report data.', color: 'error' })
      return {
        executiveSummary: [],
        performanceRates: [],
        topPerformers: {
          highestTransfer: { name: 'N/A', value: '0' },
          highestSales: { name: 'N/A', value: '0' },
          mostImproved: { name: 'N/A', value: '0%' }
        }
      }
    }
  },
  {}
)

const executiveSummaryData = computed(() => agencyData.value?.executiveSummary || [])
const performanceRatesData = computed(() => agencyData.value?.performanceRates || [])

const topPerformers = computed(() => {
  return agencyData.value?.topPerformers || {
    highestTransfer: { name: 'N/A', value: '0' },
    highestSales: { name: 'N/A', value: '0' },
    mostImproved: { name: 'N/A', value: '0%' }
  }
})

const rangeKey = computed(() => `${formatDateEST(range.value.start)}-${formatDateEST(range.value.end)}`)
let refreshTimeout: ReturnType<typeof setTimeout> | undefined
watch(rangeKey, () => {
  if (refreshTimeout) clearTimeout(refreshTimeout)
  refreshTimeout = setTimeout(() => {
    refreshAgency()
  }, 300)
})

const executiveSummaryColumns: TableColumn<ExecutiveSummaryRow>[] = [{
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
}, {
  accessorKey: 'notes',
  header: 'Notes'
}]

const performanceRatesColumns: TableColumn<PerformanceRateRow>[] = [{
  accessorKey: 'kpi',
  header: 'KPI'
}, {
  accessorKey: 'rate',
  header: 'Rate'
}, {
  accessorKey: 'formula',
  header: 'Formula'
}, {
  accessorKey: 'interpretation',
  header: 'Interpretation'
}]
</script>

<template>
  <UDashboardPanel id="reports-agency">
    <template #header>
      <UDashboardNavbar title="Reports" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <HomeDateRangePicker v-model="range" class="-ms-1" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UPageCard variant="subtle">
          <template #title>
            <div class="flex w-full items-center justify-between gap-3">
              <span class="min-w-0">Weekly Agency Performance Report</span>
              <div class="flex shrink-0 items-center">
                <UButton
                  variant="outline"
                  size="xs"
                  icon="i-lucide-download"
                  @click.stop="exportAgencyReport"
                >
                  Export
                </UButton>
              </div>
            </div>
          </template>

          <template #description>
            {{ agencyWeekLabel }}
          </template>
        </UPageCard>

        <UPageCard title="Executive Summary" description="A quick overview of the agency’s weekly performance." variant="subtle">
          <UTable
            :data="executiveSummaryData"
            :columns="executiveSummaryColumns"
            :loading="agencyStatus === 'pending'"
            :ui="{ thead: '[&>tr]:bg-elevated/50' }"
          />
        </UPageCard>

        <UPageCard title="Performance Rates" variant="subtle">
          <UTable
            :data="performanceRatesData"
            :columns="performanceRatesColumns"
            :loading="agencyStatus === 'pending'"
            :ui="{ thead: '[&>tr]:bg-elevated/50' }"
          />
        </UPageCard>

        <UPageCard title="Top performers of the week" description="Highlighting individuals or teams boosts morale." variant="subtle">
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-default bg-default/30 p-4">
              <div class="text-xs font-medium text-muted">Highest Transfer</div>
              <div class="mt-1 font-medium text-highlighted">
                {{ topPerformers.highestTransfer.name }}
              </div>
              <div class="text-sm text-muted">{{ topPerformers.highestTransfer.value }}</div>
            </div>

            <div class="rounded-lg border border-default bg-default/30 p-4">
              <div class="text-xs font-medium text-muted">Highest Sales</div>
              <div class="mt-1 font-medium text-highlighted">
                {{ topPerformers.highestSales.name }}
              </div>
              <div class="text-sm text-muted">{{ topPerformers.highestSales.value }}</div>
            </div>

            <div class="rounded-lg border border-default bg-default/30 p-4">
              <div class="text-xs font-medium text-muted">Most Improved Center</div>
              <div class="mt-1 font-medium text-highlighted">
                {{ topPerformers.mostImproved.name }}
              </div>
              <div class="text-sm text-muted">{{ topPerformers.mostImproved.value }}</div>
            </div>
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
