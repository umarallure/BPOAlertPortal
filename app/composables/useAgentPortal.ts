export const useAgentPortal = () => {
  const supabase = useAgentSupabaseClient()

  const fetchAgentData = async () => {
    const { data, error } = await supabase
      .from('agents')
      .select('*')

    if (error) throw error
    return data
  }

  const syncDataToAgentPortal = async (data: any) => {
    const { data: result, error } = await supabase
      .from('daily_deal_flow')
      .insert(data)

    if (error) throw error
    return result
  }

  return {
    fetchAgentData,
    syncDataToAgentPortal
  }
}