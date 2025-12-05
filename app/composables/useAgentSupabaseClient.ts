import { createClient } from '@supabase/supabase-js'

export const useAgentSupabaseClient = () => {
  const config = useRuntimeConfig()

  return createClient(
    config.public.supabaseAgentUrl,
    config.public.supabaseAgentKey
  )
}