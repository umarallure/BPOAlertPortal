import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'

// Singleton instance to prevent multiple clients
let clientInstance: ReturnType<typeof createClient<Database>> | null = null

export const useSupabaseClient = () => {
  if (clientInstance) {
    return clientInstance
  }

  const config = useRuntimeConfig()
  
  clientInstance = createClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    }
  )
  
  return clientInstance
}
