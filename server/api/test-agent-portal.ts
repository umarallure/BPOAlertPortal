import { createClient } from '@supabase/supabase-js'

export default eventHandler(async (event) => {
  const config = useRuntimeConfig()

  const supabase = createClient(
    config.public.supabaseAgentUrl,
    config.public.supabaseAgentKey
  )

  try {
    // Test connection by fetching table info
    const { data, error } = await supabase
      .from('daily_deal_flow')
      .select('count', { count: 'exact', head: true })

    if (error) {
      return {
        success: false,
        error: error.message,
        project: 'Agent Portal'
      }
    }

    return {
      success: true,
      message: 'Successfully connected to Agent Portal Supabase project',
      recordCount: data,
      project: 'Agent Portal'
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      project: 'Agent Portal'
    }
  }
})