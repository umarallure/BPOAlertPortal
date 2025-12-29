import type { Database } from '~~/types/supabase'
import { fetchByContiguousRanges } from '~/utils/supabaseWorkingDayQuery'
import { formatDateEST } from '~/utils'

export type DailyDealFlow = Database['public']['Tables']['daily_deal_flow']['Row']
export type DailyDealFlowInsert = Database['public']['Tables']['daily_deal_flow']['Insert']
export type DailyDealFlowUpdate = Database['public']['Tables']['daily_deal_flow']['Update']

export const useDailyDealFlow = () => {
  const supabase = useSupabaseClient()
  const { role, leadVendor, refresh: refreshRole, loading: roleLoading } = useAccessRole()

  // Fetch paginated daily deal flow entries
  const fetchAll = async (filters?: {
    date?: string
    dateFrom?: string
    dateTo?: string
    agent?: string
    status?: string
    carrier?: string
    callResult?: string
    leadVendor?: string
    insuredName?: string
    limit?: number
    offset?: number
  }) => {
    const pageSize = filters?.limit || 1000
    const offset = filters?.offset || 0

    // Ensure role is resolved before building scoped queries
    if (role.value === 'unknown' && !roleLoading.value) {
      await refreshRole()
    }
    
    let query = supabase
      .from('daily_deal_flow')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Center users can only see their own lead_vendor records
    if (role.value === 'center' && leadVendor.value) {
      query = query.eq('lead_vendor', leadVendor.value)
    }

    // Apply filters
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters?.agent && filters.agent !== 'all') {
      query = query.eq('agent', filters.agent)
    }
    if (filters?.carrier && filters.carrier !== 'all') {
      query = query.eq('carrier', filters.carrier)
    }
    if (filters?.callResult && filters.callResult !== 'all') {
      query = query.eq('call_result', filters.callResult)
    }
    if (filters?.leadVendor && filters.leadVendor !== 'all') {
      query = query.eq('lead_vendor', filters.leadVendor)
    }
    if (filters?.insuredName) {
      query = query.ilike('insured_name', `%${filters.insuredName}%`)
    }
    if (filters?.dateFrom && filters?.dateTo) {
      query = query.gte('date', filters.dateFrom).lte('date', filters.dateTo)
    } else if (filters?.dateFrom) {
      query = query.gte('date', filters.dateFrom)
    } else if (filters?.dateTo) {
      query = query.lte('date', filters.dateTo)
    }

    const { data, error, count } = await query
    
    if (error) {
      console.error('Error fetching data:', error)
      return { data: [], error, count: 0 }
    }
    
    console.log('Fetched records:', data?.length, 'Total count:', count)
    return { data: data || [], error: null, count: count || 0 }
  }

  const fetchAllByWorkingDates = async (params: {
    dates: Date[]
    agent?: string
    status?: string
    carrier?: string
    callResult?: string
    leadVendor?: string
    insuredName?: string
    limit?: number
    offset?: number
  }) => {
    const { dates, ...rest } = params

    const { data, error } = await fetchByContiguousRanges<DailyDealFlow>(
      dates,
      async (range) => {
        const res = await fetchAll({
          ...rest,
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          limit: range.limit,
          offset: range.offset
        })

        return {
          data: res.data,
          error: res.error,
          count: res.count
        }
      },
      { pageSize: params.limit || 10000 }
    )

    if (error || !data) {
      return { data: [], error, count: 0 }
    }

    return { data, error: null, count: data.length }
  }

  // Fetch single entry by ID
  const fetchById = async (id: string) => {
    const { data, error } = await supabase
      .from('daily_deal_flow')
      .select('*')
      .eq('id', id)
      .single()
    
    return { data, error }
  }

  // Create new entry
  const create = async (entry: DailyDealFlowInsert) => {
    const { data, error } = await supabase
      .from('daily_deal_flow')
      .insert(entry)
      .select()
      .single()
    
    return { data, error }
  }

  // Update entry
  const update = async (id: string, updates: DailyDealFlowUpdate) => {
    const { data, error } = await supabase
      .from('daily_deal_flow')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    return { data, error }
  }

  // Delete entry
  const remove = async (id: string) => {
    const { error } = await supabase
      .from('daily_deal_flow')
      .delete()
      .eq('id', id)
    
    return { error }
  }

  // Subscribe to real-time changes
  const subscribe = (callback: (payload: any) => void) => {
    const channel = supabase
      .channel('daily_deal_flow_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_deal_flow'
        },
        callback
      )
      .subscribe()
    
    return channel
  }

  // Get metrics for dashboard
  const getMetrics = async (date?: string) => {
    const targetDate = date || formatDateEST(new Date())
    
    const { data, error } = await supabase
      .from('daily_deal_flow')
      .select('*')
      .eq('date', targetDate)
    
    if (error) return { metrics: null, error }

    const metrics = {
      totalTransfers: data?.length || 0,
      totalSales: data?.filter(d => d.status === 'Pending Approval').length || 0,
      totalUnderwriting: data?.filter(d => d.status === 'Pending Approval' && d.call_result === 'Underwriting').length || 0,
      approvalRate: 0,
      callbackRate: 0,
      dqRate: 0
    }

    // Calculate approval rate
    if (metrics.totalTransfers > 0) {
      metrics.approvalRate = (metrics.totalSales / metrics.totalTransfers) * 100
    }

    // Calculate callback rate
    const callbacks = data?.filter(d => d.is_callback).length || 0
    if (metrics.totalTransfers > 0) {
      metrics.callbackRate = (callbacks / metrics.totalTransfers) * 100
    }

    // Calculate DQ rate (entries with DQ-related status)
    const dqStatuses = ['DQ', 'Quality Issue', 'Failed Quality Check']
    const dqCount = data?.filter(d => dqStatuses.includes(d.status || '')).length || 0
    if (metrics.totalTransfers > 0) {
      metrics.dqRate = (dqCount / metrics.totalTransfers) * 100
    }

    return { metrics, error: null }
  }

  return {
    fetchAll,
    fetchAllByWorkingDates,
    fetchById,
    create,
    update,
    remove,
    subscribe,
    getMetrics
  }
}
