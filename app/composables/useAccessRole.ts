import { computed } from 'vue'
import type { ComputedRef } from 'vue'

type AccessRole = 'unknown' | 'admin' | 'center'

type CenterAccess = {
  role: ComputedRef<AccessRole>
  leadVendor: ComputedRef<string | null>
  loading: ComputedRef<boolean>
  refresh: () => Promise<void>
  reset: () => void
}
//when he logs in the take his center or vendor, 
//then when he makes any query, remove center form params, add this center into the header
//guard: this composable should be used to determine access level and center/vendor info
export const useAccessRole = (): CenterAccess => {
  const supabase = useSupabaseClient()

  const roleState = useState<AccessRole>('access_role', () => 'unknown')
  const leadVendorState = useState<string | null>('access_lead_vendor', () => null)
  const loadingState = useState<boolean>('access_loading', () => false)

  const reset = () => {
    roleState.value = 'unknown'
    leadVendorState.value = null
    loadingState.value = false
  }

  const refresh = async () => {
    if (!import.meta.client) {
      return
    }

    loadingState.value = true

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.id) {
        reset()
        return
      }

      const { data: center, error } = await supabase
        .from('centers')
        .select('lead_vendor')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        // If query fails, do not block navigation; treat as admin for now.
        roleState.value = 'admin'
        leadVendorState.value = null
        return
      }

      if (center?.lead_vendor) {
        roleState.value = 'center'
        leadVendorState.value = center.lead_vendor
        return
      }

      roleState.value = 'admin'
      leadVendorState.value = null
    } finally {
      loadingState.value = false
    }
  }

  return {
    role: computed(() => roleState.value),
    leadVendor: computed(() => leadVendorState.value),
    loading: computed(() => loadingState.value),
    refresh,
    reset
  }
}
