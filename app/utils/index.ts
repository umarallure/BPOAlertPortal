export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFrom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!
}

export interface DailyDealFlowMetrics {
  totalTransfers: number
  pendingApproval: number
  underwriting: number
  approved: number
  giCurrentlyDq: number
}

export function calculateMetricsFromData(
  data: any[] | null | undefined,
  count: number | null | undefined
): DailyDealFlowMetrics {
  const totalCount = count || 0
  const pendingCount = data?.filter(d => d.status === 'Pending Approval').length || 0
  const underwritingCount = data?.filter(d => d.call_result === 'Underwriting').length || 0
  const approvedCount = pendingCount - underwritingCount
  const giCurrentlyDqCount = data?.filter(d => d.status === 'GI - Currently DQ').length || 0

  return {
    totalTransfers: totalCount,
    pendingApproval: pendingCount,
    underwriting: underwritingCount,
    approved: approvedCount,
    giCurrentlyDq: giCurrentlyDqCount
  }
}

export function calculatePercentageChange(
  todayValue: number,
  yesterdayValue: number
): number {
  if (yesterdayValue === 0) {
    return todayValue > 0 ? 100 : 0
  }
  return Math.round(((todayValue - yesterdayValue) / yesterdayValue) * 100)
}

export function calculateMetricsWithComparison(
  todayData: any[] | null | undefined,
  todayCount: number | null | undefined,
  yesterdayData: any[] | null | undefined,
  yesterdayCount: number | null | undefined
): {
  metrics: DailyDealFlowMetrics
  changes: {
    totalTransfers: number
    pendingApproval: number
    underwriting: number
    approved: number
    giCurrentlyDq: number
  }
} {
  const todayMetrics = calculateMetricsFromData(todayData, todayCount)
  const yesterdayMetrics = calculateMetricsFromData(yesterdayData, yesterdayCount)

  return {
    metrics: todayMetrics,
    changes: {
      totalTransfers: calculatePercentageChange(
        todayMetrics.totalTransfers,
        yesterdayMetrics.totalTransfers
      ),
      pendingApproval: calculatePercentageChange(
        todayMetrics.pendingApproval,
        yesterdayMetrics.pendingApproval
      ),
      underwriting: calculatePercentageChange(
        todayMetrics.underwriting,
        yesterdayMetrics.underwriting
      ),
      approved: calculatePercentageChange(
        todayMetrics.approved,
        yesterdayMetrics.approved
      ),
      giCurrentlyDq: calculatePercentageChange(
        todayMetrics.giCurrentlyDq,
        yesterdayMetrics.giCurrentlyDq
      )
    }
  }
}

export interface StatConfig {
  title: string
  icon: string
  color: string
}

export interface StatResult {
  title: string
  icon: string
  value: number
  variation: number
  color: string
}

export function getBaseStatsConfig(): StatConfig[] {
  return [
    {
      title: 'Total Transfers',
      icon: 'i-lucide-send',
      color: 'primary'
    },
    {
      title: 'Pending Approval',
      icon: 'i-lucide-clock',
      color: 'warning'
    },
    {
      title: 'Underwriting',
      icon: 'i-lucide-file-text',
      color: 'info'
    },
    {
      title: 'Approved',
      icon: 'i-lucide-check-circle',
      color: 'success'
    },
    {
      title: 'GI - Currently DQ',
      icon: 'i-lucide-alert-triangle',
      color: 'error'
    }
  ]
}

export function getDefaultStats(): StatResult[] {
  return getBaseStatsConfig().map((stat) => ({
    title: stat.title,
    icon: stat.icon,
    value: 0,
    variation: 0,
    color: stat.color
  }))
}

export function buildStatsFromMetrics(
  metrics: DailyDealFlowMetrics,
  changes: {
    totalTransfers: number
    pendingApproval: number
    underwriting: number
    approved: number
    giCurrentlyDq: number
  }
): StatResult[] {
  return [
    {
      title: 'Total Transfers',
      icon: 'i-lucide-send',
      value: metrics.totalTransfers,
      variation: changes.totalTransfers,
      color: 'primary'
    },
    {
      title: 'Pending Approval',
      icon: 'i-lucide-clock',
      value: metrics.pendingApproval,
      variation: changes.pendingApproval,
      color: 'warning'
    },
    {
      title: 'Underwriting',
      icon: 'i-lucide-file-text',
      value: metrics.underwriting,
      variation: changes.underwriting,
      color: 'info'
    },
    {
      title: 'Approved',
      icon: 'i-lucide-check-circle',
      value: metrics.approved,
      variation: changes.approved,
      color: 'success'
    },
    {
      title: 'GI - Currently DQ',
      icon: 'i-lucide-alert-triangle',
      value: metrics.giCurrentlyDq,
      variation: changes.giCurrentlyDq,
      color: 'error'
    }
  ]
}

export function formatDateEST(date: Date): string {
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'short',
    timeZone: 'America/New_York'
  })
  return dateFormatter.format(date)
}

export function getPreviousPeriodRange(
  range: { start: Date; end: Date },
  subDays: (date: Date, amount: number) => Date
): {
  start: Date
  end: Date
} {
  const daysDiff = Math.floor((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const previousEnd = subDays(range.start, 1)
  const previousStart = subDays(previousEnd, daysDiff - 1)
  
  return {
    start: previousStart,
    end: previousEnd
  }
}

export async function fetchAnalyticsStats(
  range: { start: Date; end: Date },
  fetchAll: (params: {
    dateFrom: string
    dateTo: string
    limit: number
    offset: number
  }) => Promise<{
    data: any[] | null
    count: number | null
    error: any
  }>,
  subDays: (date: Date, amount: number) => Date
): Promise<StatResult[]> {
  try {
    const dateFrom = formatDateEST(range.start)
    const dateTo = formatDateEST(range.end)

    const previousRange = getPreviousPeriodRange(range, subDays)
    const previousDateFrom = formatDateEST(previousRange.start)
    const previousDateTo = formatDateEST(previousRange.end)

    const { data: currentData, count: currentCount, error: currentError } = await fetchAll({
      dateFrom,
      dateTo,
      limit: 10000,
      offset: 0
    })

    if (currentError) {
      console.error('Error fetching current period analytics data:', currentError)
      return getDefaultStats()
    }

    const { data: previousData, count: previousCount, error: previousError } = await fetchAll({
      dateFrom: previousDateFrom,
      dateTo: previousDateTo,
      limit: 10000,
      offset: 0
    })

    if (previousError) {
      console.error('Error fetching previous period analytics data:', previousError)
      const { metrics } = calculateMetricsWithComparison(
        currentData,
        currentCount,
        null,
        0
      )
      return buildStatsFromMetrics(metrics, {
        totalTransfers: 0,
        pendingApproval: 0,
        underwriting: 0,
        approved: 0,
        giCurrentlyDq: 0
      })
    }

    const { metrics, changes } = calculateMetricsWithComparison(
      currentData,
      currentCount,
      previousData,
      previousCount
    )

    return buildStatsFromMetrics(metrics, changes)
  } catch (err) {
    console.error('Analytics error:', err)
    return getDefaultStats()
  }
}