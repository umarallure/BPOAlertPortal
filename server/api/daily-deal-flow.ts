import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'
import type { DailyDealFlow } from '~/types'

export default eventHandler(async () => {
  const config = useRuntimeConfig()
  
  const supabase = createClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseKey
  )
  
  const { data, error } = await supabase
    .from('daily_deal_flow')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message
    })
  }
  
  return data as DailyDealFlow[]
})
