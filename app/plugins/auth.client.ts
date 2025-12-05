export default defineNuxtPlugin({
  name: 'auth',
  enforce: 'pre',
  async setup() {
    const supabase = useSupabaseClient()
    const router = useRouter()

    // Check initial session before any navigation
    const { data: { session } } = await supabase.auth.getSession()
    
    // Add navigation guard
    router.beforeEach(async (to, from) => {
      const { data: { session } } = await supabase.auth.getSession()
      
      // If authenticated and on login page, redirect to home
      if (session && to.path === '/login') {
        return '/'
      }

      // Allow navigation to login page
      if (to.path === '/login') {
        return true
      }
      
      // Redirect to login if not authenticated
      if (!session) {
        return '/login'
      }
      
      return true
    })

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (router.currentRoute.value.path === '/login') {
          router.push('/')
        }
      }
    })
  }
})
