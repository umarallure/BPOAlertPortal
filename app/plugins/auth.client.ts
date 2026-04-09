const RESTRICTED_USER_ID = '7e0adce3-9870-4902-9a40-e8e42e314cfe'
const COLOMBIAN_PATHS = ['/colombian-score-board', '/colombian-daily-deal-flow', '/colombian-bpo-centers']

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
      
      // Redirect restricted user to Colombian Score Board if accessing other pages
      if (session?.user?.id === RESTRICTED_USER_ID && !COLOMBIAN_PATHS.includes(to.path)) {
        return '/colombian-score-board'
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
