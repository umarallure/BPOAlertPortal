export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') {
    return
  }

  const supabase = useSupabaseClient()
  const { role, loading, refresh } = useAccessRole()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return
  }

  if (role.value === 'unknown' && !loading.value) {
    await refresh()
  }

  if (role.value === 'center' && to.path !== '/daily-deal-flow') {
    return navigateTo('/daily-deal-flow')
  }
})
